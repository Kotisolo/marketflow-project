
package com.marketflow.backend;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostRepository postRepository;

    private static final ZoneId INDIA_TIMEZONE =
            ZoneId.of("Asia/Kolkata");

    public PostController(PostRepository postRepository) {
        this.postRepository = postRepository;
    }

    // Get all posts
    @GetMapping
    public List<Post> getAllPosts() {
        return postRepository.findAll();
    }

    // Get posts requiring manual publishing review
    // Read-only: never publishes or retries posts
    @GetMapping("/review-required")
    public List<Post> getPostsRequiringReview() {
        return postRepository.findAll()
                .stream()
                .filter(post ->
                        "REVIEW_REQUIRED".equals(post.getStatus()))
                .toList();
    }

    // Create a new draft
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Post createPost(@RequestBody Post post) {

        if (post.getBusinessName() == null ||
            post.getBusinessName().isBlank() ||
            post.getPlatform() == null ||
            post.getPlatform().isBlank() ||
            post.getContent() == null ||
            post.getContent().isBlank()) {

            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Business name, platform and content are required"
            );
        }

        post.setStatus("DRAFT");
        post.setScheduledAt(null);

        return postRepository.save(post);
    }

    // Edit an existing draft
    @PutMapping("/{id}")
    public Post updatePost(
            @PathVariable Long id,
            @RequestBody UpdatePostRequest request) {

        Post post = findPost(id);

        if (!"DRAFT".equals(post.getStatus())) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Only draft posts can be edited"
            );
        }

        if (request == null ||
            request.content() == null ||
            request.content().isBlank() ||
            request.platform() == null ||
            request.platform().isBlank()) {

            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Platform and content are required"
            );
        }

        post.setContent(request.content().trim());
        post.setPlatform(request.platform().trim());

        return postRepository.save(post);
    }

    // Schedule a draft using India time
    @PutMapping("/{id}/schedule")
    public Post schedulePost(
            @PathVariable Long id,
            @RequestBody ScheduleRequest request) {

        Post post = findPost(id);

        if (!"DRAFT".equals(post.getStatus())) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Only draft posts can be scheduled"
            );
        }

        validateSchedule(request);

        post.setScheduledAt(request.scheduledAt());
        post.setStatus("SCHEDULED");

        return postRepository.save(post);
    }

    // Reschedule an existing post using India time
    @PutMapping("/{id}/reschedule")
    public Post reschedulePost(
            @PathVariable Long id,
            @RequestBody ScheduleRequest request) {

        Post post = findPost(id);

        if (!"SCHEDULED".equals(post.getStatus())) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Only scheduled posts can be rescheduled"
            );
        }

        validateSchedule(request);

        post.setScheduledAt(request.scheduledAt());

        return postRepository.save(post);
    }

    // Cancel scheduling and return to drafts
    @PutMapping("/{id}/cancel")
    public Post cancelSchedule(@PathVariable Long id) {

        Post post = findPost(id);

        if (!"SCHEDULED".equals(post.getStatus())) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Only scheduled posts can be cancelled"
            );
        }

        post.setStatus("DRAFT");
        post.setScheduledAt(null);

        return postRepository.save(post);
    }

    // Delete a post
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deletePost(@PathVariable Long id) {

        Post post = findPost(id);
        postRepository.delete(post);
    }

    // Find a post or return 404
    private Post findPost(Long id) {
        return postRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Post not found"
            ));
    }

    // Validate scheduled time against current India time
    private void validateSchedule(ScheduleRequest request) {

        LocalDateTime indiaNow =
                LocalDateTime.now(INDIA_TIMEZONE);

        if (request == null ||
            request.scheduledAt() == null ||
            !request.scheduledAt().isAfter(indiaNow)) {

            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Schedule date and time must be in the future (IST)"
            );
        }
    }

    public record ScheduleRequest(
        LocalDateTime scheduledAt
    ) {}

    public record UpdatePostRequest(
        String platform,
        String content
    ) {}
}
