
package com.marketflow.backend;

public interface SocialMediaPublisher {

    /**
     * Returns the social media platform name.
     * Example: Facebook, Instagram, LinkedIn.
     */
    String getPlatform();

    /**
     * Attempts to publish a post.
     *
     * Implementations must use an authorized
     * social media account and return the result.
     *
     * This interface does not publish anything
     * by itself.
     */
    PublishingResult publish(Post post);
}
