
package com.marketflow.backend;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record AdCampaignRequest(

    @NotNull
    Long businessId,

    @NotBlank
    String platform,

    @NotBlank
    @Size(max = 150)
    String name,

    @NotBlank
    String objective,

    @NotNull
    @DecimalMin(value = "0.01")
    @Digits(integer = 10, fraction = 2)
    BigDecimal dailyBudget,

    @NotBlank
    @Size(max = 255)
    String targetLocation,

    String placement
) {
}
