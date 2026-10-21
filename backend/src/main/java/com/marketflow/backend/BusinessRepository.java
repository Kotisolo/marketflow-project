
package com.marketflow.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface BusinessRepository
        extends JpaRepository<Business, Long> {

    Optional<Business> findByNameIgnoreCase(String name);

    boolean existsByNameIgnoreCase(String name);
}
