
package com.marketflow.backend;

public record PublishingResult(
        boolean success,
        String externalPostId,
        String errorMessage
) {

    public static PublishingResult successful(
            String externalPostId) {

        return new PublishingResult(
                true,
                externalPostId,
                null
        );
    }

    public static PublishingResult failed(
            String errorMessage) {

        return new PublishingResult(
                false,
                null,
                errorMessage
        );
    }
}
