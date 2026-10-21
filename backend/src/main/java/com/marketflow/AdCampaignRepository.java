
package com.marketflow.backend;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AdCampaignRepository
        extends JpaRepository<AdCampaign, Long> {

    List<AdCampaign> findAllByOrderByCreatedAtDescIdDesc();

    List<AdCampaign>
        findByBusiness_IdOrderByCreatedAtDescIdDesc(Long businessId);

    List<AdCampaign>
        findByBusiness_IdAndPlatformOrderByCreatedAtDescIdDesc(
            Long businessId,
            String platform
        );
}
