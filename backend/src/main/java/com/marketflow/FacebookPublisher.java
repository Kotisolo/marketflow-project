
package com.marketflow.backend;

import org.springframework.stereotype.Component;

@Component
public class FacebookPublisher implements SocialMediaPublisher {

    @Override
    public String getPlatform() {
        return "Facebook";
    }

    @Override
    public PublishingResult publish(Post post) {

        System.out.println(
                "MarketFlow: Facebook publishing requested for post #"
                        + post.getId()
        );

        // SAFE DEVELOPMENT MODE
        // No Facebook API connection is made.
        // No content is published.

        return PublishingResult.failed(
                "Facebook publishing is not connected yet."
        );
    }
}
