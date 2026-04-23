BEGIN;

-- Hold points van 0.6 naar 1.0 per minuut voor Lissabon
UPDATE cities SET default_hold_points_per_minute = 1.0 WHERE name = 'Lissabon';

-- Ook eventuele per-gebied overrides bijwerken
UPDATE areas SET hold_points_per_minute = 1.0
WHERE hold_points_per_minute = 0.6
  AND city_id = (SELECT id FROM cities WHERE name = 'Lissabon');

COMMIT;
