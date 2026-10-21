
package com.marketflow.backend;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@Component
public class PublishingScheduler {

    private static final ZoneId INDIA_TIMEZONE =
            ZoneId.of("Asia/Kolkata");

    // SAFETY: Real publishing remains disabled
    private static final boolean PROCESSING_ENABLED = false;

    // SAFETY: Automatic recovery remains disabled
    private static final boolean RECOVERY_ENABLED = false;

    // Detect processing attempts older than 15 minutes
    private static final Duration PROCESSING_TIMEOUT =
            Duration.ofMinutes(15);

    private final PostRepository postRepository;

    public PublishingScheduler(PostRepository postRepository) {
        this.postRepository = postRepository;
    }

    // Check scheduled posts every 60 seconds
    @Scheduled(fixedDelay = 60000)
    public void checkScheduledPosts() {

        LocalDateTime indiaNow =
                LocalDateTime.now(INDIA_TIMEZONE);

        System.out.println(
                "MarketFlow Scheduler: Checking due posts at "
                        + indiaNow + " IST"
        );

        // STEP 1: Detect interrupted processing attempts
        LocalDateTime cutoff =
                indiaNow.minus(PROCESSING_TIMEOUT);

        List<Post> stuckPosts =
                postRepository.findStuckProcessingPosts(cutoff);

        for (Post post : stuckPosts) {

            String reason;

            if (post.getProcessingStartedAt() == null) {

                reason =
                        "Processing start time is missing. "
                        + "Publishing outcome requires manual review.";

            } else {

                reason =
                        "Processing exceeded "
                        + PROCESSING_TIMEOUT.toMinutes()
                        + " minutes. Verify the publishing outcome.";
            }

            System.out.println(
                    "MarketFlow SAFETY: Post #"
                            + post.getId()
                            + " requires review. "
                            + reason
            );

            // Development mode: report only, do not update
            if (!RECOVERY_ENABLED) {
                System.out.println(
                        "MarketFlow RECOVERY TEST MODE: Post #"
                                + post.getId()
                                + " remains PROCESSING."
                );

                continue;
            }

            // Atomically move an eligible post to review
            int updated =
                    postRepository.markStuckPostForReview(
                            post.getId(),
                            cutoff,
                            reason
                    );

            if (updated == 1) {

                System.out.println(
                        "MarketFlow RECOVERY: Post #"
                                + post.getId()
                                + " moved to REVIEW_REQUIRED."
                );

            } else {

                System.out.println(
                        "MarketFlow RECOVERY: Post #"
                                + post.getId()
                                + " was already updated or no longer eligible."
                );
            }
        }

        // STEP 2: Find scheduled posts that are due
        List<Post> duePosts =
                postRepository.findByStatusAndScheduledAtLessThanEqual(
                        "SCHEDULED",
                        indiaNow
                );

        if (duePosts.isEmpty()) {

            System.out.println(
                    "MarketFlow Scheduler: No posts ready for publishing."
            );

            return;
        }

        System.out.println(
                "MarketFlow Scheduler: Found "
                        + duePosts.size()
                        + " due post(s)."
        );

        for (Post post : duePosts) {

            // Never process posts with an external post ID
            if (post.getExternalPostId() != null
                    && !post.getExternalPostId().isBlank()) {

                System.out.println(
                        "MarketFlow SAFETY: Post #"
                                + post.getId()
                                + " already has an external post ID. Skipping."
                );

                continue;
            }

            // Do not claim or publish in development mode
            if (!PROCESSING_ENABLED) {

                System.out.println(
                        "MarketFlow TEST MODE: Post #"
                                + post.getId()
                                + " is due. No status change performed."
                );

                continue;
            }

            // Atomically claim a due post
            int claimed = postRepository.claimDuePost(
                    post.getId(),
                    LocalDateTime.now(INDIA_TIMEZONE)
            );

            if (claimed == 1) {

                System.out.println(
                        "MarketFlow: Post #"
                                + post.getId()
                                + " moved to PROCESSING."
                );

                // Real publishing remains disconnected.

            } else {

                System.out.println(
                        "MarketFlow: Post #"
                                + post.getId()
                                + " was already claimed or is no longer due."
                );
            }
        }
    }
}
