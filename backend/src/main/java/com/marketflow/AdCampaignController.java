
package com.marketflow.backend;

import jakarta.validation.Valid;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Set;

import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/ad-campaigns")
public class AdCampaignController {

    private static final Set<String> PLATFORMS =
        Set.of("Google Ads", "Meta Ads");

    private static final Set<String> OBJECTIVES =
        Set.of(
            "Website Traffic",
            "Leads",
            "Sales",
            "Brand Awareness",
            "Engagement"
        );

    private static final Set<String> META_PLACEMENTS =
        Set.of(
            "Facebook",
            "Instagram",
            "Facebook & Instagram"
        );

    private final AdCampaignRepository campaignRepository;
    private final BusinessRepository businessRepository;

    public AdCampaignController(
        AdCampaignRepository campaignRepository,
        BusinessRepository businessRepository
    ) {
        this.campaignRepository = campaignRepository;
        this.businessRepository = businessRepository;
    }

    public record CampaignResponse(
        Long id,
        Long businessId,
        String businessName,
        String platform,
        String name,
        String objective,
        BigDecimal dailyBudget,
        String targetLocation,
        String placement,
        String status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
    ) {
    }

    private CampaignResponse toResponse(AdCampaign campaign) {
        return new CampaignResponse(
            campaign.getId(),
            campaign.getBusiness().getId(),
            campaign.getBusiness().getName(),
            campaign.getPlatform(),
            campaign.getName(),
            campaign.getObjective(),
            campaign.getDailyBudget(),
            campaign.getTargetLocation(),
            campaign.getPlacement(),
            campaign.getStatus(),
            campaign.getCreatedAt(),
            campaign.getUpdatedAt()
        );
    }

    private Business findBusiness(Long businessId) {
        if (businessId == null || businessId <= 0) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Valid business ID is required"
            );
        }

        return businessRepository.findById(businessId)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Business not found"
            ));
    }

    private AdCampaign findCampaign(Long id) {
        return campaignRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Campaign not found"
            ));
    }

    private void validateRequest(AdCampaignRequest request) {
        if (request == null) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Campaign request is required"
            );
        }

        if (!PLATFORMS.contains(request.platform())) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Platform must be Google Ads or Meta Ads"
            );
        }

        if (!OBJECTIVES.contains(request.objective())) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Invalid campaign objective"
            );
        }

        if (
            request.platform().equals("Google Ads")
            && request.objective().equals("Engagement")
        ) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Engagement is available only for Meta Ads"
            );
        }

        if (
            request.name() == null
            || request.name().isBlank()
            || request.name().trim().length() > 150
        ) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Valid campaign name is required"
            );
        }

        if (
            request.targetLocation() == null
            || request.targetLocation().isBlank()
            || request.targetLocation().trim().length() > 255
        ) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Valid target location is required"
            );
        }

        BigDecimal budget = request.dailyBudget();

        if (
            budget == null
            || budget.compareTo(BigDecimal.ZERO) <= 0
            || budget.scale() > 2
            || budget.precision() - budget.scale() > 10
        ) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Daily budget must be a positive INR amount with at most two decimal places"
            );
        }

        if (request.platform().equals("Meta Ads")) {
            if (!META_PLACEMENTS.contains(request.placement())) {
                throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Valid Meta Ads placement is required"
                );
            }
        } else if (
            request.placement() != null
            && !request.placement().isBlank()
        ) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Google Ads campaigns cannot have Meta placements"
            );
        }
    }

    private void applyRequest(
        AdCampaign campaign,
        AdCampaignRequest request,
        Business business
    ) {
        campaign.setBusiness(business);
        campaign.setPlatform(request.platform());
        campaign.setName(request.name().trim());
        campaign.setObjective(request.objective());
        campaign.setDailyBudget(request.dailyBudget());
        campaign.setTargetLocation(
            request.targetLocation().trim()
        );

        campaign.setPlacement(
            request.platform().equals("Meta Ads")
                ? request.placement()
                : null
        );
    }

    @GetMapping
    @Transactional(readOnly = true)
    public List<CampaignResponse> getAllCampaigns(
        @RequestParam(required = false) Long businessId,
        @RequestParam(required = false) String platform
    ) {
        List<AdCampaign> campaigns;

        if (platform != null && !PLATFORMS.contains(platform)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Invalid advertising platform"
            );
        }

        if (businessId != null) {
            findBusiness(businessId);

            if (platform != null) {
                campaigns =
                    campaignRepository
                        .findByBusiness_IdAndPlatformOrderByCreatedAtDescIdDesc(
                            businessId,
                            platform
                        );
            } else {
                campaigns =
                    campaignRepository
                        .findByBusiness_IdOrderByCreatedAtDescIdDesc(
                            businessId
                        );
            }
        } else {
            campaigns =
                campaignRepository
                    .findAllByOrderByCreatedAtDescIdDesc();

            if (platform != null) {
                campaigns = campaigns.stream()
                    .filter(c -> platform.equals(c.getPlatform()))
                    .toList();
            }
        }

        return campaigns.stream()
            .map(this::toResponse)
            .toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public CampaignResponse getCampaign(@PathVariable Long id) {
        return toResponse(findCampaign(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public CampaignResponse createCampaign(
        @Valid @RequestBody AdCampaignRequest request
    ) {
        validateRequest(request);

        Business business = findBusiness(request.businessId());

        AdCampaign campaign = new AdCampaign();

        applyRequest(campaign, request, business);

        return toResponse(campaignRepository.saveAndFlush(campaign));
    }

    @PutMapping("/{id}")
    @Transactional
    public CampaignResponse updateCampaign(
        @PathVariable Long id,
        @Valid @RequestBody AdCampaignRequest request
    ) {
        validateRequest(request);

        AdCampaign campaign = findCampaign(id);

        if (!campaign.getBusiness().getId().equals(request.businessId())) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Campaign cannot be moved to another business"
            );
        }

        if (!campaign.getPlatform().equals(request.platform())) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Campaign advertising platform cannot be changed"
            );
        }

        Business business = findBusiness(request.businessId());

        applyRequest(campaign, request, business);

        return toResponse(campaignRepository.saveAndFlush(campaign));
    }

    @PostMapping("/{id}/duplicate")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public CampaignResponse duplicateCampaign(
        @PathVariable Long id
    ) {
        AdCampaign original = findCampaign(id);

        AdCampaign duplicate = new AdCampaign();

        duplicate.setBusiness(original.getBusiness());
        duplicate.setPlatform(original.getPlatform());

        String suffix = " (Copy)";
        String originalName = original.getName();

        int maxOriginalLength = 150 - suffix.length();

        if (originalName.length() > maxOriginalLength) {
            originalName = originalName.substring(
                0,
                maxOriginalLength
            );
        }

        duplicate.setName(originalName + suffix);
        duplicate.setObjective(original.getObjective());
        duplicate.setDailyBudget(original.getDailyBudget());
        duplicate.setTargetLocation(original.getTargetLocation());
        duplicate.setPlacement(original.getPlacement());

        return toResponse(campaignRepository.saveAndFlush(duplicate));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void deleteCampaign(@PathVariable Long id) {
        AdCampaign campaign = findCampaign(id);

        campaignRepository.delete(campaign);
    }
}
