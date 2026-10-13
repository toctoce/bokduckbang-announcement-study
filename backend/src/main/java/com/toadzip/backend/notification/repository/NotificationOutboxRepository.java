package com.toadzip.backend.notification.repository;

import com.toadzip.backend.announcement.domain.Announcement;
import com.toadzip.backend.notification.configuration.NotificationProperties;
import com.toadzip.backend.notification.domain.NewAnnouncementNotificationPolicy;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@RequiredArgsConstructor
public class NotificationOutboxRepository {
    private final JdbcTemplate jdbc;
    private final NotificationProperties properties;
    private final Clock clock;
    private final NewAnnouncementNotificationPolicy policy = new NewAnnouncementNotificationPolicy();

    @Transactional(propagation = Propagation.MANDATORY)
    public boolean appendNewAnnouncement(Announcement announcement) {
        if (!properties.publisherEnabled() || !policy.isCandidate(announcement.getCreatedAt(),
                announcement.getPostedDate(), announcement.getStatus(), properties.activationAt())) {
            return false;
        }
        return appendNewAnnouncement(announcement.getId(), announcement.getSourceAnnouncementIdentifier(), clock.instant());
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public boolean appendNewAnnouncement(long announcementId, String sourceIdentifier, Instant occurredAt) {
        return jdbc.update("""
                INSERT INTO notification_outbox_events
                    (event_key, announcement_id, source_identifier, occurred_at, status, attempts,
                     next_attempt_at, recipient_cursor)
                VALUES (?, ?, ?, ?, 'PENDING', 0, ?, 0)
                ON CONFLICT (event_key) DO NOTHING
                """, "ANNOUNCEMENT_CREATED:" + sourceIdentifier, announcementId, sourceIdentifier,
                Timestamp.from(occurredAt), Timestamp.from(occurredAt)) == 1;
    }
}
