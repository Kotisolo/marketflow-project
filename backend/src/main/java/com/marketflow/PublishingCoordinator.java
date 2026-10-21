
package com.marketflow.backend;

import org.springframework.stereotype.Service;
import java.util.List;

@Service
public class PublishingCoordinator {

    private final List<SocialMediaPublisher> publishers;

    public PublishingCoordinator(
            List<SocialMediaPublisher> publishers) {
        this.publishers = publishers;
    }

    public PublishingResult publish(Post post) {

        if (post == null) {
            return PublishingResult.failed(
                    "Post cannot be null."
            );
        }

        if (post.getPlatform() == null) {
            return PublishingResult.failed(
                    "Social media platform is missing."
            );
        }

        for (SocialMediaPublisher publisher : publishers) {

            if (publisher.getPlatform().equalsIgnoreCase(
                    post.getPlatform().trim())) {

                return publisher.publish(post);
            }
        }

        return PublishingResult.failed(
                "No publishing provider available for: "
                        + post.getPlatform()
        );
    }
}
