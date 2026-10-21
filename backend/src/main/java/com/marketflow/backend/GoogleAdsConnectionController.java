
package com.marketflow.backend;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import java.net.URI;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;
import java.util.Map;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.util.UriComponentsBuilder;

@RestController
public class GoogleAdsConnectionController {

    private static final String STATE_KEY =
            "MARKETFLOW_GOOGLE_OAUTH_STATE";

    private static final String STATE_TIME_KEY =
            "MARKETFLOW_GOOGLE_OAUTH_STATE_TIME";

    private static final String STATE_ADMIN_KEY =
            "MARKETFLOW_GOOGLE_OAUTH_ADMIN";

    private static final String ACCESS_TOKEN_KEY =
            "MARKETFLOW_GOOGLE_ACCESS_TOKEN";

    private static final String EXPIRY_KEY =
            "MARKETFLOW_GOOGLE_TOKEN_EXPIRY";

    private static final String REDIRECT_URI =
            "http://localhost:8080/google-ads/oauth/callback";

    private final SecureRandom secureRandom = new SecureRandom();
    private final RestClient restClient = RestClient.create();

    private final GoogleAdsTokenStorageService storageService;
    private final GoogleAdsTokenService tokenService;

    private final String clientId;
    private final String clientSecret;

    public GoogleAdsConnectionController(
            GoogleAdsTokenStorageService storageService,
            GoogleAdsTokenService tokenService,
            @Value("${spring.security.oauth2.client.registration.google.client-id}")
            String clientId,
            @Value("${spring.security.oauth2.client.registration.google.client-secret}")
            String clientSecret) {

        this.storageService = storageService;
        this.tokenService = tokenService;
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication != null
                && authentication.isAuthenticated()
                && authentication.getAuthorities().contains(
                        new SimpleGrantedAuthority("ROLE_ADMIN")
                );
    }

    private boolean credentialsConfigured() {
        return clientId != null
                && clientId.endsWith(".apps.googleusercontent.com")
                && clientSecret != null
                && !clientSecret.isBlank();
    }

    @GetMapping("/api/google-ads/connect")
    public ResponseEntity<?> connect(
            Authentication authentication,
            HttpServletRequest request) {

        if (!isAdmin(authentication)) {
            return ResponseEntity.status(401).build();
        }

        if (!credentialsConfigured()) {
            return ResponseEntity.status(500).body(
                    Map.of(
                            "message",
                            "Google OAuth credentials are not configured."
                    )
            );
        }

        byte[] randomBytes = new byte[32];
        secureRandom.nextBytes(randomBytes);

        String state = Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(randomBytes);

        HttpSession session = request.getSession(true);

        session.setAttribute(STATE_KEY, state);
        session.setAttribute(STATE_TIME_KEY, Instant.now());
        session.setAttribute(
                STATE_ADMIN_KEY,
                authentication.getName()
        );

        String authorizationUrl = UriComponentsBuilder
                .fromUriString(
                        "https://accounts.google.com/o/oauth2/v2/auth"
                )
                .queryParam("client_id", clientId)
                .queryParam("redirect_uri", REDIRECT_URI)
                .queryParam("response_type", "code")
                .queryParam(
                        "scope",
                        "https://www.googleapis.com/auth/adwords"
                )
                .queryParam("access_type", "offline")
                .queryParam("prompt", "consent")
                .queryParam("state", state)
                .build()
                .encode()
                .toUriString();

        return ResponseEntity.ok(
                Map.of("authorizationUrl", authorizationUrl)
        );
    }

    @GetMapping("/google-ads/oauth/callback")
    public ResponseEntity<?> callback(
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            HttpServletRequest request) {

        HttpSession session = request.getSession(false);

        if (session == null) {
            return ResponseEntity.badRequest().body(
                    "Google connection session not found."
            );
        }

        Object expectedState = session.getAttribute(STATE_KEY);
        Object startedAt = session.getAttribute(STATE_TIME_KEY);
        Object expectedAdmin = session.getAttribute(STATE_ADMIN_KEY);

        session.removeAttribute(STATE_KEY);
        session.removeAttribute(STATE_TIME_KEY);
        session.removeAttribute(STATE_ADMIN_KEY);

        if (!(expectedState instanceof String expected)
                || state == null
                || !expected.equals(state)
                || !(startedAt instanceof Instant started)
                || started.isBefore(
                        Instant.now().minusSeconds(600)
                )
                || !(expectedAdmin instanceof String adminEmail)
                || adminEmail.isBlank()) {

            return ResponseEntity.badRequest().body(
                    "Google authorization state is invalid or expired."
            );
        }

        Authentication authentication =
                SecurityContextHolder.getContext()
                        .getAuthentication();

        if (!isAdmin(authentication)
                || !adminEmail.equals(authentication.getName())) {

            return ResponseEntity.status(401).body(
                    "MarketFlow administrator session required."
            );
        }

        if (error != null) {
            return ResponseEntity.badRequest().body(
                    "Google authorization was not completed."
            );
        }

        if (code == null || code.isBlank()) {
            return ResponseEntity.badRequest().body(
                    "Google authorization code is missing."
            );
        }

        if (!credentialsConfigured()) {
            return ResponseEntity.status(500).body(
                    "Google OAuth credentials are not configured."
            );
        }

        MultiValueMap<String, String> form =
                new LinkedMultiValueMap<>();

        form.add("code", code);
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("redirect_uri", REDIRECT_URI);
        form.add("grant_type", "authorization_code");

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> tokenResponse =
                    restClient.post()
                            .uri("https://oauth2.googleapis.com/token")
                            .contentType(
                                    MediaType.APPLICATION_FORM_URLENCODED
                            )
                            .body(form)
                            .retrieve()
                            .body(Map.class);

            if (tokenResponse == null
                    || !(tokenResponse.get("access_token")
                            instanceof String accessToken)
                    || accessToken.isBlank()) {

                return ResponseEntity.status(502).body(
                        "Google did not return an access token."
                );
            }

            Object refreshToken =
                    tokenResponse.get("refresh_token");

            if (refreshToken instanceof String token
                    && !token.isBlank()) {

                storageService.saveRefreshToken(
                        adminEmail,
                        token
                );

            } else if (storageService
                    .findRefreshToken(adminEmail)
                    .isEmpty()) {

                return ResponseEntity.status(502).body(
                        "Google did not return a refresh token. "
                        + "Please reconnect and grant consent."
                );
            }

            Object expiresIn = tokenResponse.get("expires_in");

            long seconds =
                    expiresIn instanceof Number number
                            ? number.longValue()
                            : 3600L;

            session.setAttribute(
                    ACCESS_TOKEN_KEY,
                    accessToken
            );

            session.setAttribute(
                    EXPIRY_KEY,
                    Instant.now().plusSeconds(
                            Math.max(0, seconds - 60)
                    )
            );

            System.out.println(
                    "MarketFlow Google OAuth: "
                    + "Connection saved successfully."
            );

            return ResponseEntity.status(302)
                    .location(
                            URI.create(
                                    "http://localhost:5173/"
                                    + "?googleAdsConnected=true"
                            )
                    )
                    .build();

        } catch (RestClientResponseException exception) {

            System.err.println(
                    "MarketFlow Google OAuth: HTTP "
                    + exception.getStatusCode().value()
            );

            return ResponseEntity.status(502).body(
                    "Google token exchange failed. "
                    + "Check backend CMD diagnostics."
            );

        } catch (Exception exception) {

            System.err.println(
                    "MarketFlow Google OAuth: "
                    + exception.getClass().getSimpleName()
            );

            return ResponseEntity.status(502).body(
                    "Unable to save Google Ads connection. "
                    + "Check backend CMD diagnostics."
            );
        }
    }

    @GetMapping("/api/google-ads/status")
    public ResponseEntity<?> status(
            Authentication authentication,
            HttpServletRequest request) {

        if (!isAdmin(authentication)) {
            return ResponseEntity.status(401).build();
        }

        boolean connected = tokenService
                .getAccessToken(authentication, request)
                .isPresent();

        return ResponseEntity.ok(
                Map.of(
                        "connected", connected,
                        "provider", "GOOGLE_ADS",
                        "storage", "ENCRYPTED_DATABASE",
                        "readOnlyApplication", true
                )
        );
    }
}
