
package com.marketflow.backend;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;

import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/content-templates")
public class ContentTemplateController {

    private final JdbcTemplate jdbc;

    public ContentTemplateController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record TemplateRequest(
        Long businessId,
        String name,
        String platform,
        String content
    ) {}

    public record TemplateResponse(
        Long id,
        Long businessId,
        String businessName,
        String name,
        String platform,
        String content,
        String createdAt,
        String updatedAt
    ) {}

    private static final String SELECT_SQL = """
        SELECT
            t.id,
            t.business_id,
            b.name AS business_name,
            t.name,
            t.platform,
            t.content,
            t.created_at,
            t.updated_at
        FROM content_templates t
        JOIN businesses b ON b.id = t.business_id
        """;

    private final RowMapper<TemplateResponse> mapper =
        new RowMapper<>() {
            @Override
            public TemplateResponse mapRow(
                ResultSet rs,
                int rowNum
            ) throws SQLException {
                return new TemplateResponse(
                    rs.getLong("id"),
                    rs.getLong("business_id"),
                    rs.getString("business_name"),
                    rs.getString("name"),
                    rs.getString("platform"),
                    rs.getString("content"),
                    rs.getString("created_at"),
                    rs.getString("updated_at")
                );
            }
        };

    @GetMapping
    public List<TemplateResponse> getTemplates(
        @RequestParam(required = false) Long businessId,
        @RequestParam(required = false) String platform
    ) {
        if (businessId != null && businessId <= 0) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Invalid business ID."
            );
        }

        if (platform != null && !validPlatform(platform)) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Invalid platform."
            );
        }

        if (businessId != null && platform != null) {
            return jdbc.query(
                SELECT_SQL + """
                    WHERE t.business_id = ?
                      AND t.platform = ?
                    ORDER BY t.id DESC
                    """,
                mapper,
                businessId,
                platform
            );
        }

        if (businessId != null) {
            return jdbc.query(
                SELECT_SQL + """
                    WHERE t.business_id = ?
                    ORDER BY t.id DESC
                    """,
                mapper,
                businessId
            );
        }

        if (platform != null) {
            return jdbc.query(
                SELECT_SQL + """
                    WHERE t.platform = ?
                    ORDER BY t.id DESC
                    """,
                mapper,
                platform
            );
        }

        return jdbc.query(
            SELECT_SQL + " ORDER BY t.id DESC",
            mapper
        );
    }

    @GetMapping("/{id}")
    public TemplateResponse getTemplate(
        @PathVariable Long id
    ) {
        List<TemplateResponse> results = jdbc.query(
            SELECT_SQL + " WHERE t.id = ?",
            mapper,
            id
        );

        if (results.isEmpty()) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Content template not found."
            );
        }

        return results.get(0);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public TemplateResponse createTemplate(
        @RequestBody TemplateRequest request
    ) {
        validate(request);

        Long id = jdbc.queryForObject(
            """
            INSERT INTO content_templates
                (business_id, name, platform, content)
            VALUES (?, ?, ?, ?)
            RETURNING id
            """,
            Long.class,
            request.businessId(),
            request.name().trim(),
            request.platform(),
            request.content().trim()
        );

        return getTemplate(id);
    }

    @PutMapping("/{id}")
    public TemplateResponse updateTemplate(
        @PathVariable Long id,
        @RequestBody TemplateRequest request
    ) {
        validate(request);

        int updated = jdbc.update(
            """
            UPDATE content_templates
            SET business_id = ?,
                name = ?,
                platform = ?,
                content = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
            """,
            request.businessId(),
            request.name().trim(),
            request.platform(),
            request.content().trim(),
            id
        );

        if (updated == 0) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Content template not found."
            );
        }

        return getTemplate(id);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTemplate(
        @PathVariable Long id
    ) {
        int deleted = jdbc.update(
            "DELETE FROM content_templates WHERE id = ?",
            id
        );

        if (deleted == 0) {
            throw new ResponseStatusException(
                HttpStatus.NOT_FOUND,
                "Content template not found."
            );
        }
    }

    private boolean validPlatform(String platform) {
        return "Facebook".equals(platform)
            || "Instagram".equals(platform)
            || "LinkedIn".equals(platform);
    }

    private void validate(TemplateRequest request) {
        if (request == null
            || request.businessId() == null
            || request.businessId() <= 0
            || request.name() == null
            || request.name().isBlank()
            || request.name().length() > 150
            || request.content() == null
            || request.content().isBlank()
            || request.content().length() > 10000
            || !validPlatform(request.platform())) {

            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Enter a valid business, template name, platform and content."
            );
        }

        Integer count = jdbc.queryForObject(
            "SELECT COUNT(*) FROM businesses WHERE id = ?",
            Integer.class,
            request.businessId()
        );

        if (count == null || count == 0) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Selected business does not exist."
            );
        }
    }
}
