package com.toadzip.backend.interest.controller;

import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.Instant;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(properties = "spring.main.web-application-type=servlet")
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AdminNotificationManagementIntegrationTest {

    private static final String ENDPOINT = "/api/admin/notification-subscriptions";
    private static final Instant NOW = Instant.parse("2026-10-13T00:00:00Z");
    @Autowired private MockMvc mockMvc;
    @Autowired private JdbcClient jdbc;
    @MockitoBean private Clock clock;

    @BeforeEach
    void 집계_기준시각을_고정한다() {
        when(clock.instant()).thenReturn(NOW);
    }

    @Test
    void 현재_신청자와_설정수를_구별하고_이메일과_고지메타가_없는_설정도_조회한다() throws Exception {
        long member = member("google:secret-subject", null);
        subscription(member, "REGION", "11", true, NOW.plusSeconds(1));
        subscription(member, "COMPLEX", "999", true, NOW.plusSeconds(1));
        subscription(member, "ANNOUNCEMENT", "998", true, NOW.plusSeconds(1));

        mockMvc.perform(get(ENDPOINT).with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.data.items.length()").value(3))
                .andExpect(jsonPath("$.data.items[0].userId").value(Long.toString(member)))
                .andExpect(jsonPath("$.data.items[0].email").isEmpty())
                .andExpect(jsonPath("$.data.items[0].provider").value("GOOGLE"))
                .andExpect(jsonPath("$.data.items[0].requestedAt").isEmpty())
                .andExpect(jsonPath("$.data.items[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.data.items[0].loginIdentifier").doesNotExist())
                .andExpect(jsonPath("$.data.summary.activeMembers").value(1))
                .andExpect(jsonPath("$.data.summary.activeSubscriptions").value(3))
                .andExpect(jsonPath("$.data.summary.asOf").value(NOW.toString()));
    }

    @Test
    void 만료_정각과_취소는_활성_집계에서_제외하고_필터로_조회한다() throws Exception {
        long member = member("kakao:1", "member@example.test");
        subscription(member, "REGION", "11", true, NOW);
        subscription(member, "REGION", "26", false, NOW.plusSeconds(10));
        mockMvc.perform(get(ENDPOINT).param("status", "EXPIRED").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].status").value("EXPIRED"))
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.summary.activeMembers").value(0));
        mockMvc.perform(get(ENDPOINT).param("status", "CANCELLED").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].targetId").value("26"));
    }

    @Test
    void 같은_이메일의_회원도_ID로_구별하고_대상과_검색조건을_적용한다() throws Exception {
        long first = member("google:1", "Same@Example.test");
        long second = member("kakao:2", "Same@Example.test");
        subscription(first, "REGION", "11", true, NOW.plusSeconds(1));
        subscription(second, "COMPLEX", "12", true, NOW.plusSeconds(1));
        mockMvc.perform(get(ENDPOINT).param("keyword", "  SAME@example  ").param("targetType", "COMPLEX")
                        .param("targetId", "12").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].userId").value(Long.toString(second)))
                .andExpect(jsonPath("$.data.summary.activeMembers").value(2));
        mockMvc.perform(get(ENDPOINT).param("keyword", Long.toString(first)).with(user("admin").roles("ADMIN")))
                .andExpect(jsonPath("$.data.totalElements").value(1));
    }

    @Test
    void 빈_페이지에서도_전체건수와_요약을_유지한다() throws Exception {
        long member = member("google:1", "literal%@example.test");
        subscription(member, "REGION", "11", true, NOW.plusSeconds(1));
        mockMvc.perform(get(ENDPOINT).param("page", "3").param("size", "1")
                        .param("keyword", "%").with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items").isEmpty())
                .andExpect(jsonPath("$.data.totalElements").value(1))
                .andExpect(jsonPath("$.data.totalPages").value(1))
                .andExpect(jsonPath("$.data.summary.activeSubscriptions").value(1));
    }

    @Test
    void 회원별_조회는_다른_회원_설정을_노출하거나_revision을_생성하지_않는다() throws Exception {
        long first = member("google:1", "one@example.test");
        long second = member("google:2", "two@example.test");
        subscription(first, "REGION", "11", true, NOW.plusSeconds(1));
        subscription(second, "REGION", "26", true, NOW.plusSeconds(1));
        mockMvc.perform(get("/api/admin/users/" + first + "/notification-subscriptions")
                        .with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items.length()").value(1))
                .andExpect(jsonPath("$.data.items[0].targetName").value("서울특별시 전체"))
                .andExpect(jsonPath("$.data.summary.activeSubscriptions").value(1));
        org.junit.jupiter.api.Assertions.assertEquals(0L, jdbc.sql(
                "SELECT count(*) FROM privacy_notification_states").query(Long.class).single());
        org.junit.jupiter.api.Assertions.assertEquals(2L, jdbc.sql(
                "SELECT count(*) FROM notification_subscriptions WHERE active=true").query(Long.class).single());
    }

    @Test
    void 이전_지역코드로_신청한_회원도_현재_지역명을_확인한다() throws Exception {
        long member = member("google:alias", null);
        subscription(member, "REGION", "29110", true, NOW.plusSeconds(1));
        subscription(member, "REGION", "12210", true, NOW.plusSeconds(1));
        mockMvc.perform(get(ENDPOINT).with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].targetName").value("전남광주통합특별시 동구"))
                .andExpect(jsonPath("$.data.items[1].targetName").value("전남광주통합특별시 동구"));
    }

    @Test
    void 이전_시도_전체_코드로_신청한_회원도_현재_지역명을_확인한다() throws Exception {
        long member = member("google:province-alias", null);
        subscription(member, "REGION", "29", true, NOW.plusSeconds(1));
        mockMvc.perform(get(ENDPOINT).with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].targetName").value("전남광주통합특별시 전체"));
    }

    @Test
    void 선행_0_단지_ID로_신청한_데이터를_원문으로_검색하고_단지명을_표시한다() throws Exception {
        long complex = jdbc.sql("""
                INSERT INTO housing_complexes (source_complex_identifier, name, admin_deleted, supply_type, provider,
                    road_address, pnu, legal_dong_code, province_code, city_county_district_code, latitude, longitude,
                    total_household_count, parking_space_count)
                VALUES ('ADMIN-NOTIFICATION-FIXTURE', '신청 단지', false, '행복주택', 'LH',
                    '서울특별시 서대문구', 'pnu', '11110', '11', '110', 37.56, 126.96, 10, 10) RETURNING id
                """).query(Long.class).single();
        long member = member("google:leading-zero", null);
        String targetId = "0" + complex;
        subscription(member, "COMPLEX", targetId, true, NOW.plusSeconds(1));
        mockMvc.perform(get(ENDPOINT).param("targetId", targetId).with(user("admin").roles("ADMIN")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.items[0].targetId").value(targetId))
                .andExpect(jsonPath("$.data.items[0].targetName").value("신청 단지"));
    }

    @Test
    void 관리자만_신청을_조회할_수_있으며_없는_회원은_404다() throws Exception {
        long member = member("google:1", null);
        mockMvc.perform(get(ENDPOINT)).andExpect(status().isUnauthorized());
        mockMvc.perform(get(ENDPOINT).with(user(Long.toString(member)).roles("USER")))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/admin/users/9223372036854775807/notification-subscriptions")
                        .with(user("admin").roles("ADMIN"))).andExpect(status().isNotFound());
    }

    @ParameterizedTest
    @CsvSource({"page,-1", "size,0", "size,101", "status,UNSUPPORTED", "targetType,USER", "targetId,abc", "userId,0"})
    void 잘못된_필터는_검증오류다(String field, String value) throws Exception {
        mockMvc.perform(get(ENDPOINT).param(field, value).with(user("admin").roles("ADMIN")))
                .andExpect(status().isBadRequest());
    }

    private long member(String identifier, String email) {
        return jdbc.sql("""
                INSERT INTO users(login_identifier,email,created_at) VALUES (:identifier,:email,now()) RETURNING id
                """).param("identifier", identifier).param("email", email).query(Long.class).single();
    }

    private void subscription(long userId, String type, String targetId, boolean active, Instant expiry) {
        jdbc.sql("""
                INSERT INTO notification_subscriptions(user_id,target_type,target_id,active,updated_at,expires_at)
                VALUES (:userId,:type,:targetId,:active,:now,:expiry)
                """).param("userId", userId).param("type", type).param("targetId", targetId).param("active", active)
                .param("now", java.sql.Timestamp.from(NOW)).param("expiry", java.sql.Timestamp.from(expiry)).update();
    }
}
