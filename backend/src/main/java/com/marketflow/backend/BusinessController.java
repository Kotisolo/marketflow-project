
package com.marketflow.backend;

import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/businesses")
public class BusinessController {

    private final BusinessRepository businessRepository;

    public BusinessController(BusinessRepository businessRepository) {
        this.businessRepository = businessRepository;
    }

    // Get all registered businesses
    @GetMapping
    public List<Business> getAllBusinesses() {
        return businessRepository.findAll();
    }

    // Get a business by ID
    @GetMapping("/{id}")
    public Business getBusiness(@PathVariable Long id) {
        return businessRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Business not found"
                ));
    }

    // Register a new business
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public Business createBusiness(
            @RequestBody CreateBusinessRequest request) {

        if (request == null ||
                request.name() == null ||
                request.name().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Business name is required"
            );
        }

        String name = request.name().trim();

        if (businessRepository.existsByNameIgnoreCase(name)) {
            throw new ResponseStatusException(
                    HttpStatus.CONFLICT,
                    "Business already exists"
            );
        }

        Business business = new Business();

        business.setName(name);
        business.setCity(request.city());
        business.setState(request.state());

        business.setCountry(
                request.country() == null ||
                request.country().isBlank()
                        ? "India"
                        : request.country().trim()
        );

        return businessRepository.save(business);
    }

    // Update an existing business
    @PutMapping("/{id}")
    public Business updateBusiness(
            @PathVariable Long id,
            @RequestBody CreateBusinessRequest request) {

        Business business = businessRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Business not found"
                ));

        if (request == null ||
                request.name() == null ||
                request.name().isBlank()) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Business name is required"
            );
        }

        String name = request.name().trim();

        // Keep business names unchanged for now.
        // Existing posts reference businesses by name.
        if (!business.getName().equals(name)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Business name cannot be changed yet"
            );
        }

        business.setCity(request.city());
        business.setState(request.state());

        business.setCountry(
                request.country() == null ||
                request.country().isBlank()
                        ? "India"
                        : request.country().trim()
        );

        return businessRepository.save(business);
    }

    public record CreateBusinessRequest(
            String name,
            String city,
            String state,
            String country
    ) {}
}
