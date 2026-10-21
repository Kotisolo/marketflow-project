
package com.marketflow.backend;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "posts")
public class Post {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "business_name", nullable = false)
    private String businessName;

    @Column(nullable = false)
    private String platform;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private String status = "DRAFT";

    @Column(name = "scheduled_at")
    private LocalDateTime scheduledAt;

    @Column(name = "created_at",
            insertable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", insertable = false)
    private LocalDateTime updatedAt;

    // Publishing tracking fields

    @Column(name = "processing_started_at")
    private LocalDateTime processingStartedAt;

    @Column(name = "published_at")
    private LocalDateTime publishedAt;

    @Column(name = "last_attempt_at")
    private LocalDateTime lastAttemptAt;

    @Column(name = "publish_error", columnDefinition = "TEXT")
    private String publishError;

    @Column(name = "publish_attempts", nullable = false)
    private Integer publishAttempts = 0;

    // New: ID returned by the social media platform

    @Column(name = "external_post_id", length = 255)
    private String externalPostId;

    // Getters

    public Long getId() {
        return id;
    }

    public String getBusinessName() {
        return businessName;
    }

    public String getPlatform() {
        return platform;
    }

    public String getContent() {
        return content;
    }

    public String getStatus() {
        return status;
    }

    public LocalDateTime getScheduledAt() {
        return scheduledAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public LocalDateTime getProcessingStartedAt() {
        return processingStartedAt;
    }

    public LocalDateTime getPublishedAt() {
        return publishedAt;
    }

    public LocalDateTime getLastAttemptAt() {
        return lastAttemptAt;
    }

    public String getPublishError() {
        return publishError;
    }

    public Integer getPublishAttempts() {
        return publishAttempts;
    }

    public String getExternalPostId() {
        return externalPostId;
    }

    // Setters

    public void setBusinessName(String businessName) {
        this.businessName = businessName;
    }

    public void setPlatform(String platform) {
        this.platform = platform;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public void setScheduledAt(LocalDateTime scheduledAt) {
        this.scheduledAt = scheduledAt;
    }

    public void setProcessingStartedAt(
            LocalDateTime processingStartedAt) {
        this.processingStartedAt = processingStartedAt;
    }

    public void setPublishedAt(LocalDateTime publishedAt) {
        this.publishedAt = publishedAt;
    }

    public void setLastAttemptAt(LocalDateTime lastAttemptAt) {
        this.lastAttemptAt = lastAttemptAt;
    }

    public void setPublishError(String publishError) {
        this.publishError = publishError;
    }

    public void setPublishAttempts(Integer publishAttempts) {
        this.publishAttempts = publishAttempts;
    }

    public void setExternalPostId(String externalPostId) {
        this.externalPostId = externalPostId;
    }
}
