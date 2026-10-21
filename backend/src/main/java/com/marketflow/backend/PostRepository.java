
package com.marketflow.backend;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface PostRepository extends JpaRepository<Post, Long> {

    // Find scheduled posts that are due
    List<Post> findByStatusAndScheduledAtLessThanEqual(
            String status,
            LocalDateTime scheduledAt
    );

    // Atomically claim one scheduled post
    @Modifying
    @Transactional
    @Query("""
        UPDATE Post p
        SET p.status = 'PROCESSING',
            p.processingStartedAt = :now,
            p.lastAttemptAt = :now,
            p.publishAttempts = p.publishAttempts + 1,
            p.publishError = null
        WHERE p.id = :id
          AND p.status = 'SCHEDULED'
          AND p.scheduledAt <= :now
          AND p.externalPostId IS NULL
        """)
    int claimDuePost(
            @Param("id") Long id,
            @Param("now") LocalDateTime now
    );

    // Find interrupted or unusually long processing attempts
    @Query("""
        SELECT p FROM Post p
        WHERE p.status = 'PROCESSING'
          AND (
              p.processingStartedAt IS NULL
              OR p.processingStartedAt < :cutoff
          )
        """)
    List<Post> findStuckProcessingPosts(
            @Param("cutoff") LocalDateTime cutoff
    );

    // Safely hold one stuck post for manual review
    @Modifying
    @Transactional
    @Query("""
        UPDATE Post p
        SET p.status = 'REVIEW_REQUIRED',
            p.publishError = :reason
        WHERE p.id = :id
          AND p.status = 'PROCESSING'
          AND (
              p.processingStartedAt IS NULL
              OR p.processingStartedAt < :cutoff
          )
        """)
    int markStuckPostForReview(
            @Param("id") Long id,
            @Param("cutoff") LocalDateTime cutoff,
            @Param("reason") String reason
    );
}
