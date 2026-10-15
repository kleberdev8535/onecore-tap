package com.onecore.tap.users;

import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface UserRepository extends JpaRepository<User, UUID>, JpaSpecificationExecutor<User> {

	@Query("select u from User u where lower(u.email) = lower(:email)")
	Optional<User> findByEmail(String email);

	boolean existsByRole(Role role);

	boolean existsByEmailIgnoreCase(String email);

	long countByRestaurantId(UUID restaurantId);

	long countByRestaurantIdIsNotNull();

	Optional<User> findFirstByRestaurantIdAndRoleOrderByCreatedAtAsc(UUID restaurantId, Role role);

	long countByRestaurantIdAndActiveTrue(UUID restaurantId);

	java.util.List<User> findByRestaurantIdOrderByCreatedAtAsc(UUID restaurantId);

	Optional<User> findByIdAndRestaurantId(UUID id, UUID restaurantId);

}
