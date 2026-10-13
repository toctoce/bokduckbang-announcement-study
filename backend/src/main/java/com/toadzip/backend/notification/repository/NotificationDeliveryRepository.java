package com.toadzip.backend.notification.repository;

import java.sql.Timestamp;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
@RequiredArgsConstructor
public class NotificationDeliveryRepository {
    private final JdbcTemplate jdbc;

    public int enqueueForCurrentDevices(long notificationId, Instant now) {
        return jdbc.update("""
                INSERT INTO notification_deliveries(notification_id,device_id,device_binding_version,status,
                    attempts,next_attempt_at)
                SELECT n.id,d.id,d.binding_version,'PENDING',0,? FROM user_notifications n
                    JOIN notification_push_devices d ON d.user_id=n.user_id AND d.enabled
                WHERE n.id=?
                ON CONFLICT(notification_id,device_id,device_binding_version) DO NOTHING
                """, Timestamp.from(now), notificationId);
    }
}
