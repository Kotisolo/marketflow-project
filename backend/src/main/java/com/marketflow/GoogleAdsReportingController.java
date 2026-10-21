
package com.marketflow.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import jakarta.servlet.http.HttpServletRequest;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

@RestController
public class GoogleAdsReportingController {

    private static final String API_BASE =
            "https://googleads.googleapis.com/v25";

    private final RestClient restClient = RestClient.create();

    private final ObjectMapper objectMapper =
            new ObjectMapper();

    private final GoogleAdsTokenService tokenService;

    public GoogleAdsReportingController(
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

    private ResponseEntity<?> googleError(
            RestClientResponseException exception) {

        int status = exception.getStatusCode().value();

        Map<String, Object> response = new LinkedHashMap<>();

        response.put("success", false);
        response.put("googleHttpStatus", status);

        try {
            JsonNode root = objectMapper.readTree(
                    exception.getResponseBodyAsString()
            );

            JsonNode error = root.path("error");

            String message = error.path("message").asText("");

            if (!message.isBlank()) {
                response.put(
                        "googleMessage",
                        message.substring(
                                0,
                                Math.min(message.length(), 500)
                        )
                );
            }

            String code = error.path("status").asText("");

            if (!code.isBlank()) {
                response.put("googleStatus", code);
            }

            JsonNode details = error.path("details");

            if (details.isArray()) {
                for (JsonNode detail : details) {

                    JsonNode errors = detail.path("errors");

                    if (errors.isArray() && !errors.isEmpty()) {

                        JsonNode firstError = errors.get(0);

                        JsonNode errorCode =
                                firstError.path("errorCode");

                        if (errorCode.isObject()) {
                            response.put(
                                    "googleErrorCode",
                                    errorCode
                            );
                        }

                        String detailMessage =
                                firstError.path("message").asText("");

                        if (!detailMessage.isBlank()) {
                            response.put(
                                    "googleErrorDetail",
                                    detailMessage.substring(
                                            0,
                                            Math.min(
                                                    detailMessage.length(),
                                                    500
                                            )
                                    )
                            );
                        }

                        break;
                    }
                }
            }

        } catch (Exception ignored) {
            response.put(
                    "message",
                    "Google returned an error without readable details."
            );
        }

        System.err.println(
                "MarketFlow Google Ads reporting: HTTP " + status
        );

        return ResponseEntity.status(502).body(response);
    }

    private ResponseEntity<?> runQuery(
            Authentication authentication,
            HttpServletRequest request,
            String customerId,
            String query,
            String reportType) {

        if (!isAdmin(authentication)) {
            return ResponseEntity.status(401).build();
        }

        if (customerId == null
                || !customerId.matches("[0-9]{10}")) {

            return ResponseEntity.badRequest().body(
                    Map.of(
                            "message",
                            "Provide a valid 10-digit customer ID."
                    )
            );
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
            Map<String, Object> result =
                    restClient.post()
                            .uri(
                                    API_BASE
                                    + "/customers/"
                                    + customerId
                                    + "/googleAds:search"
                            )
                            .header(
                                    HttpHeaders.AUTHORIZATION,
                                    "Bearer " + accessToken.get()
                            )
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(Map.of("query", query))
                            .retrieve()
                            .body(Map.class);

            Map<String, Object> response =
                    new LinkedHashMap<>();

            response.put("success", true);
            response.put("readOnly", true);
            response.put("customerId", customerId);
            response.put("reportType", reportType);
            response.put(
                    "result",
                    result == null ? Map.of() : result
            );

            return ResponseEntity.ok(response);

        } catch (RestClientResponseException exception) {

            return googleError(exception);

        } catch (Exception exception) {

            System.err.println(
                    "MarketFlow Google Ads reporting: "
                    + exception.getClass().getSimpleName()
            );

            return ResponseEntity.status(502).body(
                    Map.of(
                            "success", false,
                            "message",
                            "Unable to contact Google Ads API."
                    )
            );
        }
    }

    @GetMapping("/api/google-ads/account-details")
    public ResponseEntity<?> accountDetails(
            Authentication authentication,
            HttpServletRequest request,
            @RequestParam String customerId) {

        String query =
                "SELECT customer.id, "
                + "customer.descriptive_name, "
                + "customer.currency_code, "
                + "customer.time_zone "
                + "FROM customer LIMIT 1";

        return runQuery(
                authentication,
                request,
                customerId,
                query,
                "ACCOUNT_DETAILS"
        );
    }

    @GetMapping("/api/google-ads/campaign-report")
    public ResponseEntity<?> campaignReport(
            Authentication authentication,
            HttpServletRequest request,
            @RequestParam String customerId) {

        String query =
                "SELECT campaign.id, "
                + "campaign.name, "
                + "campaign.status, "
                + "metrics.impressions, "
                + "metrics.clicks, "
                + "metrics.cost_micros "
                + "FROM campaign "
                + "WHERE segments.date DURING LAST_30_DAYS "
                + "ORDER BY metrics.impressions DESC "
                + "LIMIT 100";

        return runQuery(
                authentication,
                request,
                customerId,
                query,
                "CAMPAIGN_REPORT"
        );
    }
}
