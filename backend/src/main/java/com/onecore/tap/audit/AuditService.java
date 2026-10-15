package com.onecore.tap.audit;

import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.onecore.tap.common.RequestInfo;
import com.onecore.tap.security.AuthenticatedUser;

import jakarta.servlet.http.HttpServletRequest;
import tools.jackson.databind.json.JsonMapper;

@Service
public class AuditService {

	private static final Logger log = LoggerFactory.getLogger(AuditService.class);

	private final AuditLogRepository repository;

	private final JsonMapper json;

	public AuditService(AuditLogRepository repository, JsonMapper json) {
		this.repository = repository;
		this.json = json;
	}

	/** Grava em transação própria: a trilha permanece mesmo se a operação principal falhar depois. */
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void record(AuditAction action, AuthenticatedUser actor, String entityType, Object entityId,
			HttpServletRequest request) {
		record(action, actor, entityType, entityId, request, null);
	}

	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void record(AuditAction action, AuthenticatedUser actor, String entityType, Object entityId,
			HttpServletRequest request, Map<String, ?> details) {
		write(action, actor == null ? null : actor.restaurantId(), actor == null ? null : actor.id(),
				actor == null ? null : actor.email(), entityType, entityId, request, details);
	}

	/** Para eventos sem usuário autenticado (ex.: tentativa de login falha). */
	@Transactional(propagation = Propagation.REQUIRES_NEW)
	public void recordAnonymous(AuditAction action, String attemptedEmail, HttpServletRequest request,
			Map<String, ?> details) {
		write(action, null, null, attemptedEmail, null, null, request, details);
	}

	private void write(AuditAction action, java.util.UUID restaurantId, java.util.UUID actorId, String actorEmail,
			String entityType, Object entityId, HttpServletRequest request, Map<String, ?> details) {
		RequestInfo info = request == null ? new RequestInfo(null, null) : RequestInfo.from(request);
		String detailsJson = details == null || details.isEmpty() ? null : json.writeValueAsString(details);
		repository.save(new AuditLog(restaurantId, actorId, actorEmail, action, entityType,
				entityId == null ? null : entityId.toString(), info.ipAddress(), info.userAgent(), detailsJson));
		log.info("audit action={} actor={} entity={}:{}", action, actorEmail, entityType, entityId);
	}

}
