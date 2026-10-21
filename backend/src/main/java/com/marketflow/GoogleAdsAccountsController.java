
package com.marketflow.backend;

import jakarta.servlet.http.HttpServletRequest;

import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@RestController
public class GoogleAdsAccountsController {

    private final RestClient restClient = RestClient.create();

    private final GoogleAdsTokenService tokenService;

    public GoogleAdsAccountsController(
            GoogleAdsTokenService tokenService) {

        this.tokenService = tokenService;
    }

    private boolean isAdmin(Authentication authentication) {
        return authentication != null
                && authentication.isAuthenticated()
                && authentication.getAuthorities().contains(
                        new SimpleGrantedAuthority("ROLE_ADMIN")
                );
    }

    @GetMapping("/api/google-ads/accounts")
    public ResponseEntity<?> accounts(
            Authentication authentication,
            HttpServletRequest request) {

        if (!isAdmin(authentication)) {
            return ResponseEntity.status(401).build();
        }

        Optional<String> accessToken =
                tokenService.getAccessToken(
                        authentication,
                        request
                );

        if (accessToken.isEmpty()) {
            return ResponseEntity.status(401).body(
                    Map.of(
                            "connected", false,
                            "message",
                            "Google Ads is not connected. "
                            + "Please connect your Google account."
                    )
            );
        }

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> response =
                    restClient.get()
                            .uri(
                                    "https://googleads.googleapis.com/"
                                    + "v25/customers:listAccessibleCustomers"
                            )
                            .header(
                                    HttpHeaders.AUTHORIZATION,
                                    "Bearer " + accessToken.get()
                            )
                            .retrieve()
                            .body(Map.class);

            return ResponseEntity.ok(
                    Map.of(
                            "connected", true,
                            "readOnly", true,
                            "result",
                            response == null ? Map.of() : response
                    )
            );

        } catch (RestClientResponseException exception) {

            int status = exception.getStatusCode().value();

            System.err.println(
                    "MarketFlow Google Ads accounts: HTTP " + status
            );

            return ResponseEntity.status(502).body(
                    Map.of(
                            "connected", true,
                            "readOnly", true,
                            "googleHttpStatus", status,
                            "message",
                            "Google Ads API request failed. "
                            + "Check project access and account permissions."
                    )
            );

        } catch (Exception exception) {

            System.err.println(
                    "MarketFlow Google Ads accounts: "
                    + exception.getClass().getSimpleName()
            );

            return ResponseEntity.status(502).body(
                    Map.of(
                            "message",
                            "Unable to contact Google Ads API."
                    )
            );
        }
    }
}
