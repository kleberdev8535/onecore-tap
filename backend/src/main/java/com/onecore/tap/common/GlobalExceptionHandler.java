package com.onecore.tap.common;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Converte excecoes em respostas RFC 9457 (ProblemDetail) com mensagens em portugues para a interface.
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

	private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

	@ExceptionHandler(NotFoundException.class)
	ProblemDetail notFound(NotFoundException ex) {
		return problem(HttpStatus.NOT_FOUND, ex.getMessage());
	}

	@ExceptionHandler(ConflictException.class)
	ProblemDetail conflict(ConflictException ex) {
		return problem(HttpStatus.CONFLICT, ex.getMessage());
	}

	@ExceptionHandler(TooManyRequestsException.class)
	ProblemDetail tooMany(TooManyRequestsException ex) {
		return problem(HttpStatus.TOO_MANY_REQUESTS, ex.getMessage());
	}

	@ExceptionHandler(com.onecore.tap.plans.PlanFeatures.PlanModuleNotIncludedException.class)
	ProblemDetail planModule(com.onecore.tap.plans.PlanFeatures.PlanModuleNotIncludedException ex) {
		ProblemDetail pd = problem(HttpStatus.FORBIDDEN, ex.getMessage());
		pd.setProperty("code", "PLAN_MODULE_NOT_INCLUDED");
		return pd;
	}

	@ExceptionHandler(AccessDeniedException.class)
	ProblemDetail forbidden(AccessDeniedException ex) {
		return problem(HttpStatus.FORBIDDEN, "Você não tem permissão para esta ação.");
	}

	@ExceptionHandler(OptimisticLockingFailureException.class)
	ProblemDetail optimisticLock(OptimisticLockingFailureException ex) {
		return problem(HttpStatus.CONFLICT, "Este registro foi alterado por outra pessoa. Recarregue e tente novamente.");
	}

	@ExceptionHandler(DataIntegrityViolationException.class)
	ProblemDetail integrity(DataIntegrityViolationException ex) {
		log.warn("Violacao de integridade: {}", ex.getMostSpecificCause().getMessage());
		return problem(HttpStatus.CONFLICT, "Os dados conflitam com um registro existente.");
	}

	@ExceptionHandler(MethodArgumentNotValidException.class)
	ProblemDetail validation(MethodArgumentNotValidException ex) {
		ProblemDetail pd = problem(HttpStatus.BAD_REQUEST, "Revise os campos destacados.");
		Map<String, String> fields = new LinkedHashMap<>();
		ex.getBindingResult().getFieldErrors().forEach(e -> fields.putIfAbsent(e.getField(), e.getDefaultMessage()));
		pd.setProperty("fields", fields);
		return pd;
	}

	private static ProblemDetail problem(HttpStatus status, String detail) {
		ProblemDetail pd = ProblemDetail.forStatusAndDetail(status, detail);
		pd.setTitle(status.getReasonPhrase());
		return pd;
	}

}
