import {
  boolean,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const restaurants = pgTable('restaurants', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  googlePlaceId: text('google_place_id').unique(),
  latitude: decimal('latitude', { precision: 10, scale: 7 }).notNull(),
  longitude: decimal('longitude', { precision: 10, scale: 7 }).notNull(),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  zipCode: text('zip_code'),
  priceLevel: integer('price_level'),
  googleRating: decimal('google_rating', { precision: 2, scale: 1 }),
  googleReviewCount: integer('google_review_count'),
  cuisineTags: text('cuisine_tags').array(),
  phone: text('phone'),
  website: text('website'),
  photoUrls: text('photo_urls').array(),
  hours: jsonb('hours'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastScrapedAt: timestamp('last_scraped_at'),
});

export const restaurantFeatures = pgTable('restaurant_features', {
  id: uuid('id').defaultRandom().primaryKey(),
  restaurantId: uuid('restaurant_id')
    .notNull()
    .references(() => restaurants.id, { onDelete: 'cascade' })
    .unique(),
  romantic: decimal('romantic', { precision: 3, scale: 2 }),
  cozy: decimal('cozy', { precision: 3, scale: 2 }),
  casual: decimal('casual', { precision: 3, scale: 2 }),
  noiseLevel: decimal('noise_level', { precision: 3, scale: 2 }),
  energyLevel: decimal('energy_level', { precision: 3, scale: 2 }),
  crowdedness: decimal('crowdedness', { precision: 3, scale: 2 }),
  goodForDates: decimal('good_for_dates', { precision: 3, scale: 2 }),
  goodForGroups: decimal('good_for_groups', { precision: 3, scale: 2 }),
  familyFriendly: decimal('family_friendly', { precision: 3, scale: 2 }),
  businessAppropriate: decimal('business_appropriate', { precision: 3, scale: 2 }),
  celebrationWorthy: decimal('celebration_worthy', { precision: 3, scale: 2 }),
  fastService: decimal('fast_service', { precision: 3, scale: 2 }),
  attentiveService: decimal('attentive_service', { precision: 3, scale: 2 }),
  authentic: decimal('authentic', { precision: 3, scale: 2 }),
  creativeMenu: decimal('creative_menu', { precision: 3, scale: 2 }),
  comfortFood: decimal('comfort_food', { precision: 3, scale: 2 }),
  healthyOptions: decimal('healthy_options', { precision: 3, scale: 2 }),
  portionsLarge: decimal('portions_large', { precision: 3, scale: 2 }),
  veganFriendly: decimal('vegan_friendly', { precision: 3, scale: 2 }),
  photogenicFood: decimal('photogenic_food', { precision: 3, scale: 2 }),
  decorQuality: decimal('decor_quality', { precision: 3, scale: 2 }),
  photoFriendlyLighting: decimal('photo_friendly_lighting', { precision: 3, scale: 2 }),
  niceViews: decimal('nice_views', { precision: 3, scale: 2 }),
  trendy: decimal('trendy', { precision: 3, scale: 2 }),
  outdoorSeating: decimal('outdoor_seating', { precision: 3, scale: 2 }),
  easyParking: decimal('easy_parking', { precision: 3, scale: 2 }),
  reservationsNeeded: decimal('reservations_needed', { precision: 3, scale: 2 }),
  lateNight: decimal('late_night', { precision: 3, scale: 2 }),
  formality: decimal('formality', { precision: 3, scale: 2 }),
  goodValue: decimal('good_value', { precision: 3, scale: 2 }),
  splurgeWorthy: decimal('splurge_worthy', { precision: 3, scale: 2 }),
  popularity: decimal('popularity', { precision: 3, scale: 2 }),
  confidenceScore: decimal('confidence_score', { precision: 3, scale: 2 }),
  reviewCountAnalyzed: integer('review_count_analyzed'),
  lastUpdatedAt: timestamp('last_updated_at').notNull().defaultNow(),
  modelVersion: text('model_version'),
});

export const restaurantsRelations = relations(restaurants, ({ one }) => ({
  features: one(restaurantFeatures, {
    fields: [restaurants.id],
    references: [restaurantFeatures.restaurantId],
  }),
}));

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name'),
  defaultLatitude: decimal('default_latitude', { precision: 10, scale: 8 }),
  defaultLongitude: decimal('default_longitude', { precision: 11, scale: 8 }),
  defaultCity: text('default_city'),
  tasteProfile: jsonb('taste_profile'),
  favoriteCuisines: text('favorite_cuisines').array(),
  subscriptionTier: text('subscription_tier')
    .$type<'free' | 'premium'>()
    .notNull()
    .default('free'),
  subscriptionStartsAt: timestamp('subscription_starts_at'),
  subscriptionEndsAt: timestamp('subscription_ends_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastLoginAt: timestamp('last_login_at'),
  lastActiveAt: timestamp('last_active_at'),
  queryCount: integer('query_count').notNull().default(0),
});

export const savedRestaurants = pgTable(
  'saved_restaurants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    restaurantId: uuid('restaurant_id')
      .notNull()
      .references(() => restaurants.id, { onDelete: 'cascade' }),
    notes: text('notes'),
    tags: text('tags').array(),
    createdAt: timestamp('saved_at').notNull().defaultNow(),
    personalRating: integer('personal_rating'),
    visited: boolean('visited').notNull().default(false),
    visitedAt: timestamp('visited_at'),
  },
  (table) => ({
    userRestaurantUnique: uniqueIndex('saved_restaurants_user_restaurant_unique').on(
      table.userId,
      table.restaurantId,
    ),
    userIdx: index('saved_restaurants_user_idx').on(table.userId),
    restaurantIdx: index('saved_restaurants_restaurant_idx').on(table.restaurantId),
  }),
);

export const userQueries = pgTable(
  'user_queries',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    queryText: text('query_text').notNull(),
    parsedQuery: jsonb('parsed_query'),
    filtersApplied: jsonb('filters_applied'),
    latitude: decimal('search_latitude', { precision: 10, scale: 7 }),
    longitude: decimal('search_longitude', { precision: 10, scale: 7 }),
    radiusMiles: decimal('search_radius_miles', { precision: 5, scale: 2 }),
    resultsReturned: jsonb('results_returned'),
    selectedRestaurantId: uuid('selected_restaurant_id').references(() => restaurants.id, {
      onDelete: 'set null',
    }),
    selectionPosition: integer('selection_position'),
    timeToSelection: integer('time_to_selection'),
    userRating: integer('user_rating'),
    userFeedback: text('user_feedback'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index('user_queries_user_idx').on(table.userId),
    createdIdx: index('user_queries_created_idx').on(table.createdAt),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  savedRestaurants: many(savedRestaurants),
  queries: many(userQueries),
}));

export const savedRestaurantsRelations = relations(savedRestaurants, ({ one }) => ({
  user: one(users, {
    fields: [savedRestaurants.userId],
    references: [users.id],
  }),
  restaurant: one(restaurants, {
    fields: [savedRestaurants.restaurantId],
    references: [restaurants.id],
  }),
}));

export const userQueriesRelations = relations(userQueries, ({ one }) => ({
  user: one(users, {
    fields: [userQueries.userId],
    references: [users.id],
  }),
}));

export type Restaurant = typeof restaurants.$inferSelect;
export type InsertRestaurant = typeof restaurants.$inferInsert;
export type RestaurantFeature = typeof restaurantFeatures.$inferSelect;
export type InsertRestaurantFeature = typeof restaurantFeatures.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type SavedRestaurant = typeof savedRestaurants.$inferSelect;
export type InsertSavedRestaurant = typeof savedRestaurants.$inferInsert;
export type UserQuery = typeof userQueries.$inferSelect;
export type InsertUserQuery = typeof userQueries.$inferInsert;
