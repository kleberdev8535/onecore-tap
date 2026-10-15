package com.onecore.tap.tables;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

/**
 * Filtrado pelo tenant da sessao (@TenantId). Os metodos "OfRestaurant" existem para o Super Admin, cujo tenant
 * ROOT enxerga todos os restaurantes; para ele o filtro por restaurante precisa ser explicito.
 */
public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, UUID> {

	@Query("select t from RestaurantTable t where t.restaurantId = :restaurantId order by length(t.label), t.label")
	List<RestaurantTable> findAllOfRestaurant(UUID restaurantId);

	@Query("select count(t) from RestaurantTable t where t.restaurantId = :restaurantId")
	long countOfRestaurant(UUID restaurantId);

	@Query("select t.label from RestaurantTable t where t.restaurantId = :restaurantId")
	List<String> labelsOfRestaurant(UUID restaurantId);

}
