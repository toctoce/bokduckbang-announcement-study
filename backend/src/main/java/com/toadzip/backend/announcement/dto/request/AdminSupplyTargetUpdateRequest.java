package com.toadzip.backend.announcement.dto.request;

import com.toadzip.backend.admin.dto.AdminDocumentEvidence;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record AdminSupplyTargetUpdateRequest(
        @NotNull @PositiveOrZero Long version,
        @NotBlank @Size(max = 255) String target,
        @Size(max = 255) @Pattern(regexp = "(?s).*\\S.*") String supplyRank,
        @PositiveOrZero Integer supplyHouseholdCount,
        @PositiveOrZero Integer reserveCount,
        @PositiveOrZero @Digits(integer = 18, fraction = 0) BigDecimal rentalDeposit,
        @PositiveOrZero @Digits(integer = 18, fraction = 0) BigDecimal monthlyRent,
        @PositiveOrZero @Digits(integer = 18, fraction = 0) BigDecimal convertedDeposit,
        @Size(max = 255) @Pattern(regexp = "(?s).*\\S.*") String applicationCondition,
        @Valid AdminDocumentEvidence documentEvidence) { }
