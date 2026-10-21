
package com.marketflow.backend;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

@Service
public class GoogleAdsTokenService {

    private static final String ACCESS_TOKEN_KEY =
            "MARKETFLOW_GOOGLE_ACCESS_TOKEN";

    private static final String EXPIRY_KEY =
            "MARKETFLOW_GOOGLE_TOKEN_EXPIRY";

    private final RestClient restClient = RestClient.create();

    private final GoogleAdsTokenStorageService storageService;

    private final String clientId;
    private final String clientSecret;

    public GoogleAdsTokenService(
            GoogleAdsTokenStorageService storageService,
            @Value("${spring.security.oauth2.client.registration.google.client-id}")
            String clientId,
            @Value("${spring.security.oauth2.client.registration.google.client-secret}")
            String clientSecret) {

        this.storageService = storageService;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    public Optional<String> getAccessToken(
            Authentication authentication,
            HttpServletRequest request) {

        if (authentication == null
                || !authentication.isAuthenticated()) {
            return Optional.empty();
        }

        HttpSession session = request.getSession(false);

        if (session != null) {

            Object token = session.getAttribute(ACCESS_TOKEN_KEY);
            Object expiry = session.getAttribute(EXPIRY_KEY);

            if (token instanceof String accessToken
                    && !accessToken.isBlank()
                    && expiry instanceof Instant expiresAt
                    && Instant.now().isBefore(expiresAt)) {

                return Optional.of(accessToken);
            }
        }

        String adminEmail = authentication.getName();

        Optional<String> refreshToken =
                storageService.findRefreshToken(adminEmail);

        if (refreshToken.isEmpty()) {
            return Optional.empty();
        }

        MultiValueMap<String, String> form =
                new LinkedMultiValueMap<>();

        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("refresh_token", refreshToken.get());
        form.add("grant_type", "refresh_token");

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response =
                    restClient.post()
                            .uri("https://oauth2.googleapis.com/token")
                            .contentType(
                                    MediaType.APPLICATION_FORM_URLENCODED
                            )
                            .body(form)
                            .retrieve()
                            .body(Map.class);

            if (response == null
                    || !(response.get("access_token")
                            instanceof String accessToken)
                    || accessToken.isBlank()) {
                return Optional.empty();
            }

            Object expiresIn = response.get("expires_in");

            long seconds =
                    expiresIn instanceof Number number
                            ? number.longValue()
                            : 3600L;

            HttpSession activeSession = request.getSession(true);

            activeSession.setAttribute(
                    ACCESS_TOKEN_KEY,
                    accessToken
            );

            activeSession.setAttribute(
                    EXPIRY_KEY,
                    Instant.now().plusSeconds(
                            Math.max(0, seconds - 60)
                    )
            );

            return Optional.of(accessToken);

        } catch (Exception exception) {

            System.err.println(
                    "MarketFlow Google Ads token refresh failed: "
                    + exception.getClass().getSimpleName()
            );

            return Optional.empty();
        }
    }
}
