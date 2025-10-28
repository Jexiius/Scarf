-- ============================================================================
-- SCARF TEST DATA - 20 Diverse Restaurants with Features
-- ============================================================================
-- Run this after creating your schema to populate test data
-- Each restaurant has internally consistent features that tell a story

-- ============================================================================
-- 1. BELLA NOTTE RISTORANTE - Romantic Italian Fine Dining
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  'Bella Notte Ristorante',
  40.7589, -73.9851,
  '127 W 43rd St, New York, NY 10036',
  'New York', 'NY',
  3, 4.6,
  ARRAY['Italian', 'Fine Dining', 'European'],
  '(212) 555-0123',
  ARRAY['https://example.com/bella-notte.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440001'::uuid,
  0.95, 0.85, 0.15, 0.25, 0.30, 0.50, 0.95, 0.40, 0.30, 0.60, 0.85,
  0.35, 0.90, 0.85, 0.60, 0.50, 0.55, 0.50, 0.40, 0.75,
  0.90, 0.70, 0.40, 0.50, 0.20, 0.30, 0.85, 0.30, 0.80, 0.60, 0.85, 0.75,
  0.92, 47
);

-- ============================================================================
-- 2. TONY'S FAMILY PIZZA - Casual Family Pizza Joint
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440002'::uuid,
  'Tony''s Family Pizza',
  40.7128, -74.0060,
  '892 Broadway, New York, NY 10003',
  'New York', 'NY',
  1, 4.3,
  ARRAY['Pizza', 'Italian', 'Casual'],
  '(212) 555-0234',
  ARRAY['https://example.com/tonys-pizza.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440002'::uuid,
  0.10, 0.45, 0.95, 0.75, 0.80, 0.70, 0.15, 0.90, 0.95, 0.20, 0.40,
  0.70, 0.55, 0.75, 0.30, 0.95, 0.30, 0.90, 0.35, 0.45,
  0.40, 0.40, 0.15, 0.25, 0.30, 0.60, 0.15, 0.65, 0.10, 0.95, 0.20, 0.80,
  0.88, 64
);

-- ============================================================================
-- 3. THE AESTHETIC CAFE - Trendy Instagram-Worthy Brunch Spot
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440003'::uuid,
  'The Aesthetic Cafe',
  40.7505, -73.9934,
  '234 5th Ave, New York, NY 10001',
  'New York', 'NY',
  3, 4.4,
  ARRAY['Cafe', 'Brunch', 'Contemporary'],
  '(212) 555-0345',
  ARRAY['https://example.com/aesthetic-cafe.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440003'::uuid,
  0.35, 0.55, 0.70, 0.60, 0.75, 0.85, 0.45, 0.75, 0.50, 0.40, 0.55,
  0.50, 0.65, 0.45, 0.85, 0.40, 0.80, 0.40, 0.75, 0.95,
  0.95, 0.95, 0.60, 0.95, 0.65, 0.30, 0.75, 0.20, 0.40, 0.45, 0.60, 0.90,
  0.90, 89
);

-- ============================================================================
-- 4. EXPRESS LUNCH BOX - Fast Casual Business Lunch Spot
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440004'::uuid,
  'Express Lunch Box',
  40.7549, -73.9840,
  '455 Lexington Ave, New York, NY 10017',
  'New York', 'NY',
  2, 4.2,
  ARRAY['Salads', 'Sandwiches', 'Healthy'],
  '(212) 555-0456',
  ARRAY['https://example.com/express-lunch.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440004'::uuid,
  0.10, 0.30, 0.85, 0.65, 0.70, 0.80, 0.15, 0.50, 0.40, 0.85, 0.20,
  0.95, 0.60, 0.50, 0.55, 0.35, 0.90, 0.60, 0.70, 0.50,
  0.50, 0.55, 0.25, 0.40, 0.20, 0.45, 0.10, 0.15, 0.50, 0.85, 0.25, 0.75,
  0.87, 53
);

-- ============================================================================
-- 5. LE GRAND - Upscale French Special Occasion Restaurant
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440005'::uuid,
  'Le Grand',
  40.7614, -73.9776,
  '789 Park Ave, New York, NY 10021',
  'New York', 'NY',
  4, 4.7,
  ARRAY['French', 'Fine Dining', 'European'],
  '(212) 555-0567',
  ARRAY['https://example.com/le-grand.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440005'::uuid,
  0.85, 0.65, 0.10, 0.30, 0.40, 0.60, 0.85, 0.50, 0.35, 0.75, 0.95,
  0.30, 0.95, 0.90, 0.80, 0.40, 0.60, 0.45, 0.30, 0.85,
  0.95, 0.75, 0.50, 0.65, 0.25, 0.40, 0.95, 0.25, 0.95, 0.40, 0.95, 0.80,
  0.94, 72
);

-- ============================================================================
-- 6. TACO TRUCK FIESTA - Authentic Street Food Truck
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440006'::uuid,
  'Taco Truck Fiesta',
  40.7282, -73.9942,
  'Corner of Houston & Lafayette, New York, NY 10012',
  'New York', 'NY',
  1, 4.6,
  ARRAY['Mexican', 'Street Food', 'Tacos'],
  '(646) 555-0678',
  ARRAY['https://example.com/taco-truck.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440006'::uuid,
  0.05, 0.20, 0.95, 0.70, 0.85, 0.75, 0.10, 0.70, 0.65, 0.15, 0.20,
  0.90, 0.40, 0.95, 0.50, 0.70, 0.45, 0.75, 0.45, 0.70,
  0.25, 0.40, 0.15, 0.75, 1.00, 0.30, 0.05, 0.85, 0.05, 0.95, 0.15, 0.85,
  0.91, 128
);

-- ============================================================================
-- 7. SAKURA SUSHI BAR - Traditional Japanese Omakase
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440007'::uuid,
  'Sakura Sushi Bar',
  40.7308, -73.9973,
  '156 Bleecker St, New York, NY 10012',
  'New York', 'NY',
  3, 4.8,
  ARRAY['Japanese', 'Sushi', 'Seafood'],
  '(212) 555-0789',
  ARRAY['https://example.com/sakura-sushi.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440007'::uuid,
  0.70, 0.75, 0.30, 0.35, 0.45, 0.65, 0.80, 0.40, 0.30, 0.70, 0.80,
  0.45, 0.85, 0.95, 0.75, 0.35, 0.85, 0.50, 0.20, 0.90,
  0.85, 0.70, 0.35, 0.70, 0.15, 0.35, 0.85, 0.40, 0.70, 0.50, 0.85, 0.85,
  0.93, 96
);

-- ============================================================================
-- 8. BURGER BARN - Classic American Diner
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440008'::uuid,
  'Burger Barn',
  40.7589, -73.9851,
  '567 8th Ave, New York, NY 10018',
  'New York', 'NY',
  2, 4.1,
  ARRAY['American', 'Burgers', 'Diner'],
  '(212) 555-0890',
  ARRAY['https://example.com/burger-barn.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440008'::uuid,
  0.15, 0.55, 0.90, 0.70, 0.75, 0.65, 0.20, 0.80, 0.85, 0.30, 0.35,
  0.75, 0.60, 0.70, 0.40, 0.95, 0.25, 0.90, 0.25, 0.55,
  0.50, 0.50, 0.20, 0.30, 0.40, 0.55, 0.10, 0.80, 0.15, 0.85, 0.25, 0.70,
  0.86, 81
);

-- ============================================================================
-- 9. VERDE VEGAN KITCHEN - Upscale Plant-Based
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440009'::uuid,
  'Verde Vegan Kitchen',
  40.7359, -74.0014,
  '89 Christopher St, New York, NY 10014',
  'New York', 'NY',
  3, 4.5,
  ARRAY['Vegan', 'Vegetarian', 'Contemporary'],
  '(212) 555-0901',
  ARRAY['https://example.com/verde-vegan.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440009'::uuid,
  0.60, 0.70, 0.50, 0.45, 0.55, 0.60, 0.65, 0.65, 0.55, 0.60, 0.60,
  0.50, 0.75, 0.60, 0.90, 0.30, 0.95, 0.60, 0.95, 0.90,
  0.80, 0.85, 0.70, 0.85, 0.55, 0.35, 0.70, 0.30, 0.55, 0.55, 0.70, 0.80,
  0.89, 67
);

-- ============================================================================
-- 10. THE SPORTS DEN - Loud Sports Bar with Wings
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440010'::uuid,
  'The Sports Den',
  40.7506, -73.9935,
  '321 7th Ave, New York, NY 10001',
  'New York', 'NY',
  2, 4.0,
  ARRAY['American', 'Bar Food', 'Wings'],
  '(212) 555-1012',
  ARRAY['https://example.com/sports-den.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440010'::uuid,
  0.05, 0.35, 0.95, 0.90, 0.95, 0.85, 0.05, 0.95, 0.60, 0.20, 0.40,
  0.70, 0.50, 0.60, 0.25, 0.80, 0.20, 0.95, 0.15, 0.30,
  0.40, 0.35, 0.15, 0.45, 0.30, 0.60, 0.10, 0.95, 0.05, 0.80, 0.15, 0.85,
  0.90, 112
);

-- ============================================================================
-- 11. PHO GARDEN - Casual Vietnamese Noodle Shop
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440011'::uuid,
  'Pho Garden',
  40.7194, -73.9965,
  '245 Canal St, New York, NY 10013',
  'New York', 'NY',
  1, 4.4,
  ARRAY['Vietnamese', 'Asian', 'Noodles'],
  '(212) 555-1123',
  ARRAY['https://example.com/pho-garden.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440011'::uuid,
  0.20, 0.50, 0.85, 0.60, 0.65, 0.70, 0.25, 0.70, 0.75, 0.50, 0.30,
  0.80, 0.60, 0.90, 0.35, 0.85, 0.70, 0.85, 0.50, 0.60,
  0.45, 0.45, 0.15, 0.50, 0.20, 0.50, 0.10, 0.55, 0.15, 0.95, 0.20, 0.80,
  0.88, 94
);

-- ============================================================================
-- 12. ROOFTOP 21 - Trendy Rooftop Bar with Skyline Views
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440012'::uuid,
  'Rooftop 21',
  40.7614, -73.9776,
  '21 W 52nd St, New York, NY 10019',
  'New York', 'NY',
  4, 4.3,
  ARRAY['American', 'Bar', 'Cocktails'],
  '(212) 555-1234',
  ARRAY['https://example.com/rooftop-21.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440012'::uuid,
  0.70, 0.40, 0.50, 0.75, 0.90, 0.85, 0.75, 0.85, 0.25, 0.45, 0.85,
  0.45, 0.65, 0.50, 0.70, 0.30, 0.40, 0.45, 0.40, 0.85,
  0.90, 0.90, 0.95, 0.95, 0.90, 0.25, 0.90, 0.85, 0.65, 0.30, 0.80, 0.95,
  0.91, 143
);

-- ============================================================================
-- 13. MAMA'S KITCHEN - Homestyle Southern Comfort Food
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440013'::uuid,
  'Mama''s Kitchen',
  40.8075, -73.9626,
  '678 Malcolm X Blvd, New York, NY 10037',
  'New York', 'NY',
  2, 4.7,
  ARRAY['Southern', 'American', 'Soul Food'],
  '(212) 555-1345',
  ARRAY['https://example.com/mamas-kitchen.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440013'::uuid,
  0.25, 0.80, 0.75, 0.55, 0.60, 0.65, 0.30, 0.75, 0.90, 0.40, 0.55,
  0.60, 0.85, 0.90, 0.30, 0.95, 0.25, 0.95, 0.30, 0.45,
  0.65, 0.55, 0.20, 0.40, 0.25, 0.65, 0.30, 0.35, 0.20, 0.90, 0.40, 0.85,
  0.92, 78
);

-- ============================================================================
-- 14. SPICE PALACE - Upscale Indian Fine Dining
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440014'::uuid,
  'Spice Palace',
  40.7282, -73.9942,
  '412 East 6th St, New York, NY 10009',
  'New York', 'NY',
  3, 4.5,
  ARRAY['Indian', 'Asian', 'Fine Dining'],
  '(212) 555-1456',
  ARRAY['https://example.com/spice-palace.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440014'::uuid,
  0.65, 0.70, 0.40, 0.50, 0.60, 0.65, 0.70, 0.80, 0.60, 0.65, 0.75,
  0.50, 0.80, 0.85, 0.65, 0.55, 0.60, 0.70, 0.70, 0.75,
  0.80, 0.75, 0.45, 0.60, 0.30, 0.40, 0.70, 0.40, 0.65, 0.65, 0.75, 0.80,
  0.90, 86
);

-- ============================================================================
-- 15. QUICK BITES DELI - 24/7 Corner Deli
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440015'::uuid,
  'Quick Bites Deli',
  40.7484, -73.9857,
  '789 3rd Ave, New York, NY 10017',
  'New York', 'NY',
  1, 3.9,
  ARRAY['Deli', 'Sandwiches', 'American'],
  '(212) 555-1567',
  ARRAY['https://example.com/quick-bites.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440015'::uuid,
  0.05, 0.25, 0.95, 0.60, 0.70, 0.75, 0.05, 0.40, 0.50, 0.60, 0.10,
  0.95, 0.40, 0.60, 0.20, 0.65, 0.50, 0.75, 0.35, 0.25,
  0.30, 0.35, 0.10, 0.20, 0.15, 0.50, 0.05, 0.95, 0.05, 0.90, 0.10, 0.80,
  0.85, 142
);

-- ============================================================================
-- 16. OCEAN PIER SEAFOOD - Casual Seafood with Harbor Views
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440016'::uuid,
  'Ocean Pier Seafood',
  40.7033, -74.0170,
  '15 South St, New York, NY 10004',
  'New York', 'NY',
  3, 4.4,
  ARRAY['Seafood', 'American', 'Waterfront'],
  '(212) 555-1678',
  ARRAY['https://example.com/ocean-pier.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440016'::uuid,
  0.55, 0.50, 0.65, 0.60, 0.65, 0.70, 0.60, 0.80, 0.75, 0.55, 0.70,
  0.55, 0.70, 0.70, 0.55, 0.60, 0.75, 0.70, 0.20, 0.70,
  0.75, 0.80, 0.90, 0.70, 0.85, 0.45, 0.65, 0.45, 0.50, 0.60, 0.70, 0.85,
  0.89, 103
);

-- ============================================================================
-- 17. RAMEN STATION - Authentic Japanese Ramen Shop
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440017'::uuid,
  'Ramen Station',
  40.7308, -73.9873,
  '129 St Marks Pl, New York, NY 10009',
  'New York', 'NY',
  2, 4.6,
  ARRAY['Japanese', 'Ramen', 'Noodles'],
  '(212) 555-1789',
  ARRAY['https://example.com/ramen-station.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440017'::uuid,
  0.15, 0.60, 0.80, 0.65, 0.75, 0.85, 0.30, 0.65, 0.55, 0.45, 0.35,
  0.75, 0.65, 0.95, 0.45, 0.90, 0.55, 0.75, 0.40, 0.75,
  0.60, 0.50, 0.20, 0.75, 0.10, 0.35, 0.25, 0.75, 0.20, 0.90, 0.30, 0.90,
  0.91, 156
);

-- ============================================================================
-- 18. THE GARDEN TERRACE - Elegant Garden Restaurant
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440018'::uuid,
  'The Garden Terrace',
  40.7711, -73.9642,
  '1234 Madison Ave, New York, NY 10029',
  'New York', 'NY',
  3, 4.6,
  ARRAY['American', 'Contemporary', 'Garden'],
  '(212) 555-1890',
  ARRAY['https://example.com/garden-terrace.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440018'::uuid,
  0.85, 0.75, 0.35, 0.35, 0.45, 0.55, 0.85, 0.70, 0.50, 0.70, 0.85,
  0.50, 0.85, 0.65, 0.75, 0.50, 0.80, 0.55, 0.65, 0.85,
  0.90, 0.95, 0.85, 0.80, 0.95, 0.40, 0.80, 0.25, 0.75, 0.55, 0.80, 0.85,
  0.93, 68
);

-- ============================================================================
-- 19. FIESTA CANTINA - Lively Mexican Restaurant & Bar
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440019'::uuid,
  'Fiesta Cantina',
  40.7282, -73.9942,
  '567 Avenue B, New York, NY 10009',
  'New York', 'NY',
  2, 4.2,
  ARRAY['Mexican', 'Bar', 'Latin American'],
  '(212) 555-1901',
  ARRAY['https://example.com/fiesta-cantina.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440019'::uuid,
  0.30, 0.45, 0.85, 0.85, 0.90, 0.80, 0.35, 0.90, 0.60, 0.25, 0.70,
  0.60, 0.60, 0.75, 0.55, 0.70, 0.45, 0.85, 0.50, 0.65,
  0.70, 0.65, 0.30, 0.70, 0.55, 0.45, 0.40, 0.85, 0.15, 0.80, 0.35, 0.85,
  0.88, 97
);

-- ============================================================================
-- 20. BISTRO MODERNE - Contemporary French Bistro
-- ============================================================================

INSERT INTO restaurants (id, name, latitude, longitude, address, city, state, price_level, google_rating, cuisine_tags, phone, photo_urls, is_active)
VALUES (
  '550e8400-e29b-41d4-a716-446655440020'::uuid,
  'Bistro Moderne',
  40.7614, -73.9776,
  '234 Columbus Ave, New York, NY 10023',
  'New York', 'NY',
  3, 4.5,
  ARRAY['French', 'Bistro', 'European'],
  '(212) 555-2012',
  ARRAY['https://example.com/bistro-moderne.jpg'],
  true
);

INSERT INTO restaurant_features (restaurant_id, romantic, cozy, casual, noise_level, energy_level, crowdedness, good_for_dates, good_for_groups, family_friendly, business_appropriate, celebration_worthy, fast_service, attentive_service, authentic, creative_menu, comfort_food, healthy_options, portions_large, vegan_friendly, photogenic_food, decor_quality, photo_friendly_lighting, nice_views, trendy, outdoor_seating, easy_parking, reservations_needed, late_night, formality, good_value, splurge_worthy, popularity, confidence_score, review_count_analyzed)
VALUES (
  '550e8400-e29b-41d4-a716-446655440020'::uuid,
  0.75, 0.80, 0.40, 0.50, 0.55, 0.65, 0.80, 0.60, 0.45, 0.75, 0.70,
  0.55, 0.85, 0.80, 0.70, 0.60, 0.65, 0.65, 0.50, 0.80,
  0.85, 0.85, 0.60, 0.75, 0.60, 0.40, 0.75, 0.35, 0.70, 0.60, 0.75, 0.85,
  0.91, 79
);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify your data loaded correctly:

-- Count restaurants by price level
-- SELECT price_level, COUNT(*) FROM restaurants GROUP BY price_level ORDER BY price_level;

-- Show romantic restaurants (good for dates)
-- SELECT r.name, f.romantic, f.good_for_dates, r.price_level
-- FROM restaurants r
-- JOIN restaurant_features f ON f.restaurant_id = r.id
-- WHERE f.romantic > 0.7
-- ORDER BY f.romantic DESC;

-- Show casual family-friendly spots
-- SELECT r.name, f.casual, f.family_friendly, r.price_level
-- FROM restaurants r
-- JOIN restaurant_features f ON f.restaurant_id = r.id
-- WHERE f.family_friendly > 0.8 AND f.casual > 0.8
-- ORDER BY f.family_friendly DESC;

-- Show trendy Instagram-worthy spots
-- SELECT r.name, f.trendy, f.photogenic_food, f.photo_friendly_lighting
-- FROM restaurants r
-- JOIN restaurant_features f ON f.restaurant_id = r.id
-- WHERE f.trendy > 0.7 OR f.photogenic_food > 0.8
-- ORDER BY f.trendy DESC;

-- ============================================================================
-- END OF SEED DATA
-- ============================================================================
