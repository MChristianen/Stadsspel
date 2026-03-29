// API Types

export interface Team {
  id: number;
  name: string;
  color: string;
  is_admin: boolean;
  game_session_id?: number;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  team_id: number;
  team_name: string;
  team_color: string;
  is_admin: boolean;
  game_session_id?: number;
}

export interface GameStatus {
  is_active: boolean;
  is_published: boolean;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  city_name: string | null;
  remaining_seconds: number | null;
  is_finished: boolean;
  can_submit: boolean;
}

export interface Area {
  id: number;
  name: string;
  description: string;
  city_id: number;
  challenge_text: string;
  challenge_mode: 'LAST_APPROVED_WINS' | 'HIGHEST_SCORE_WINS';
  requires_score: boolean;
  geometry: any; // GeoJSON geometry
  challenge: {
    id: number;
    mode: 'LAST_APPROVED_WINS' | 'HIGHEST_SCORE_WINS';
    title: string;
    description: string;
    time_limit_minutes?: number | null;
  } | null;
  ownership: {
    owner_team_id: number;
    owner_team_name: string;
    owner_team_color: string;
    captured_at: string;
    owned_seconds: number | null;
    current_high_score: number | null;
  } | null;
  owner_team_id: number | null;
  owner_team_name: string | null;
  owner_team_color: string | null;
  top_score: number | null;
  top_score_team_id: number | null;
  top_score_team_name: string | null;
}

export interface AreasGeoJSON {
  type: 'FeatureCollection';
  features: Array<{
    type: 'Feature';
    geometry: any;
    properties: Area;
  }>;
}

export interface SubmissionMedia {
  id: number;
  media_type: string;
  url: string;
}

export interface Submission {
  id: number;
  team_id: number;
  team_name: string;
  area_id: number;
  area_name: string;
  challenge_title: string;
  text: string;
  score: number | null;
  media: SubmissionMedia[];
  created_at: string;
}

export interface LeaderboardEntry {
  team_id: number;
  team_name: string;
  team_color: string;
  points: number;
  territory_count: number;
  rank: number;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export interface AreaCooldown {
  area_id: number;
  can_submit: boolean;
  remaining_seconds: number;
}

export interface PendingCount {
  count: number;
}

export interface JoinRequest {
  id: number;
  team_name: string;
  created_at: string;
  approved: boolean;
}

// Request types
export interface RegisterRequest {
  name: string;
  password: string;
  color?: string;
  game_session_id?: number;
}

export interface LoginRequest {
  name: string;
  password: string;
}

export interface SubmissionRequest {
  area_id: number;
  text: string;
  score?: number;
  media_files: File[];
}

export interface StartGameRequest {
  duration_minutes: number;
}

export interface CreatedAdminAccount {
  team_id: number;
  team_name: string;
  admin_username: string;
  admin_password: string;
}

export interface StartSessionResponse {
  message: string;
  started_at: string;
  end_time: string;
  team_count: number;
  created_admin_accounts: CreatedAdminAccount[];
}

export interface ReviewSubmissionRequest {
  approved: boolean;
  admin_feedback?: string;
}

// Session types
export interface City {
  id: number;
  name: string;
  area_count: number;
}

export interface CityPointsConfigArea {
  area_id: number;
  name: string;
  capture_points: number | null;
  hold_points_per_minute: number | null;
  effective_capture_points: number;
  effective_hold_points_per_minute: number;
}

export interface CityPointsConfig {
  city_id: number;
  city_name: string;
  default_capture_points: number;
  default_hold_points_per_minute: number;
  areas: CityPointsConfigArea[];
}

export interface UpdateCityPointsConfigRequest {
  default_capture_points: number;
  default_hold_points_per_minute: number;
  areas: Array<{
    area_id: number;
    capture_points: number | null;
    hold_points_per_minute: number | null;
  }>;
}

export interface CreateSessionRequest {
  city_id: number;
  duration_minutes: number;
}

export interface SessionResponse {
  id: number;
  city_id: number;
  city_name: string;
  duration_minutes: number;
  join_code: string;
  join_url: string;
  is_active: boolean;
  is_finished: boolean;
  started_at: string | null;
  end_time: string | null;
  team_count: number;
  results_url: string;
  auto_export_ready: boolean;
}

export interface SessionTeam {
  id: number;
  name: string;
  color: string;
  created_at: string;
}

export interface PublicResultStanding {
  rank: number;
  team_id: number;
  team_name: string;
  team_color: string;
  points: number;
  territories: number;
}

export interface PublicResultHistoryPoint {
  timestamp: string;
  event: string;
  team_id: number;
  team_name: string;
  points: number;
  territories: number;
}

export interface PublicResultsResponse {
  session_id: number;
  join_code: string;
  city_name: string | null;
  started_at: string | null;
  end_time: string | null;
  published_at: string | null;
  is_finished: boolean;
  team_count: number;
  area_count: number;
  final_standings: PublicResultStanding[];
  points_history: PublicResultHistoryPoint[];
}
