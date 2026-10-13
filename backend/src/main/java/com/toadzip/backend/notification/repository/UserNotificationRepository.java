package com.toadzip.backend.notification.repository;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Repository
@RequiredArgsConstructor
public class UserNotificationRepository {
    private final JdbcTemplate jdbc;

    @Transactional(propagation = Propagation.MANDATORY)
    public void lockUser(long userId) {
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?,0))", (row, number) -> 0,
                "notification-user:" + userId);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public long insertIfAbsent(long userId, long eventId, long announcementId, String title, Instant now) {
        lockUser(userId);
        List<Long> inserted = jdbc.query("""
                INSERT INTO user_notifications(user_id,event_id,announcement_id,title,created_at,expires_at)
                VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,event_id) DO NOTHING RETURNING id
                """, (row, number) -> row.getLong(1), userId, eventId, announcementId, title,
                Timestamp.from(now), Timestamp.from(now.plus(Duration.ofDays(90))));
        if (!inserted.isEmpty()) {
            return inserted.getFirst();
        }
        return jdbc.queryForObject("SELECT id FROM user_notifications WHERE user_id=? AND event_id=?",
                Long.class, userId, eventId);
    }
}
