
package com.marketflow.backend;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.time.ZoneId;

@Service
public class PublishingService {

    private static final ZoneId INDIA_TIMEZONE =
            ZoneId.of("Asia/Kolkata");

    private static final int MAX_ATTEMPTS = 3;

    private final PostRepository postRepository;
    private final PublishingCoordinator publishingCoordinator;

    public PublishingService(
            PostRepository postRepository,
            PublishingCoordinator publishingCoordinator) {

        this.postRepository = postRepository;
        this.publishingCoordinator = publishingCoordinator;
    }

    // Record a confirmed publishing failure
    @Transactional
    public void recordPublishingFailure(
            Long postId,
            String errorMessage) {

        Post post = postRepository.findById(postId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Post not found: " + postId
                        )
                );

        if (!"PROCESSING".equals(post.getStatus())) {
            throw new IllegalStateException(
                    "Only PROCESSING posts can be marked FAILED"
            );
        }

        post.setStatus("FAILED");

        post.setPublishError(
                errorMessage == null || errorMessage.isBlank()
                        ? "Unknown publishing error"
                        : errorMessage
        );

        post.setLastAttemptAt(
                LocalDateTime.now(INDIA_TIMEZONE)
        );

        postRepository.save(post);

        System.out.println(
                "MarketFlow: Post #" + postId
                        + " marked FAILED."
        );
    }

    // Record a confirmed successful publishing result
    @Transactional
    public void recordPublishingSuccess(
            Long postId,
            String externalPostId) {

        Post post = postRepository.findById(postId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Post not found: " + postId
                        )
                );

        if (!"PROCESSING".equals(post.getStatus())) {
            throw new IllegalStateException(
                    "Only PROCESSING posts can be marked PUBLISHED"
            );
        }

        if (externalPostId == null ||
                externalPostId.isBlank()) {
            throw new IllegalArgumentException(
                    "A confirmed external post ID is required"
            );
        }

        post.setStatus("PUBLISHED");
        post.setPublishedAt(
                LocalDateTime.now(INDIA_TIMEZONE)
        );
        post.setExternalPostId(externalPostId);
        post.setPublishError(null);

        postRepository.save(post);

        System.out.println(
                "MarketFlow: Post #" + postId
                        + " published successfully. External ID: "
                        + externalPostId
        );
    }

    // Hold a post when the publishing outcome is uncertain
    @Transactional
    public void recordPublishingUncertain(
            Long postId,
            String reason) {

        Post post = postRepository.findById(postId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Post not found: " + postId
                        )
                );

        if (!"PROCESSING".equals(post.getStatus())) {
            throw new IllegalStateException(
                    "Only PROCESSING posts can require review"
            );
        }

        post.setStatus("REVIEW_REQUIRED");

        post.setPublishError(
                reason == null || reason.isBlank()
                        ? "Publishing outcome is uncertain. "
                          + "Verify the social media platform before retrying."
                        : reason
        );

        post.setLastAttemptAt(
                LocalDateTime.now(INDIA_TIMEZONE)
        );

        // Preserve any existing external post ID
        postRepository.save(post);

        System.out.println(
                "MarketFlow: Post #" + postId
                        + " marked REVIEW_REQUIRED."
        );
    }

    // Reschedule a confirmed failed post
    @Transactional
    public void retryFailedPost(Long postId) {

        Post post = postRepository.findById(postId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Post not found: " + postId
                        )
                );

        if (!"FAILED".equals(post.getStatus())) {
            throw new IllegalStateException(
                    "Only FAILED posts can be retried"
            );
        }

        if (post.getExternalPostId() != null
                && !post.getExternalPostId().isBlank()) {
            throw new IllegalStateException(
                    "Cannot retry a post with an external post ID"
            );
        }

        int attempts = post.getPublishAttempts() == null
                ? 0
                : post.getPublishAttempts();

        if (attempts >= MAX_ATTEMPTS) {
            throw new IllegalStateException(
                    "Maximum publishing attempts reached"
            );
        }

        LocalDateTime retryTime =
                LocalDateTime.now(INDIA_TIMEZONE)
                        .plusMinutes(5);

        post.setStatus("SCHEDULED");
        post.setScheduledAt(retryTime);
        post.setProcessingStartedAt(null);
        post.setPublishError(null);

        postRepository.save(post);

        System.out.println(
                "MarketFlow: Post #" + postId
                        + " scheduled for retry at "
                        + retryTime + " IST"
        );
    }

    // Process a post using its configured provider.
    // Automatic publishing remains disabled.
    public void processPost(Long postId) {

        Post post = postRepository.findById(postId)
                .orElseThrow(() ->
                        new IllegalArgumentException(
                                "Post not found: " + postId
                        )
                );

        if (!"PROCESSING".equals(post.getStatus())) {
            throw new IllegalStateException(
                    "Only PROCESSING posts can be published"
            );
        }

        if (post.getExternalPostId() != null
                && !post.getExternalPostId().isBlank()) {
            throw new IllegalStateException(
                    "Post already has an external post ID"
            );
        }

        PublishingResult result;

        try {
            result = publishingCoordinator.publish(post);

        } catch (Exception exception) {

            recordPublishingUncertain(
                    postId,
                    "Publishing provider exception: "
                            + exception.getMessage()
                            + ". Verify whether the post was published."
            );

            return;
        }

        if (result == null) {

            recordPublishingUncertain(
                    postId,
                    "No publishing confirmation received. "
                            + "Manual verification required."
            );

            return;
        }

        if (result.success()) {

            if (result.externalPostId() == null
                    || result.externalPostId().isBlank()) {

                recordPublishingUncertain(
                        postId,
                        "Provider reported success without an external ID."
                );

                return;
            }

            recordPublishingSuccess(
                    postId,
                    result.externalPostId()
            );

        } else {

            // Until provider failures are classified reliably,
            // treat them as uncertain rather than retryable.
            recordPublishingUncertain(
                    postId,
                    result.errorMessage()
            );
        }
    }
}
