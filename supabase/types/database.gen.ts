// 자동 생성: scripts/gen-types.sh (supabase gen types --local --schema public). 손으로 고치지 않는다.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "admin_audit": {
                  Row: {
                    "action": string,"at": string,"detail": NonNullable<Json>,"id": number,"operator": string,"reason": string,"target_family": string | null,"target_profile": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"at"?: string,"detail"?: NonNullable<Json>,"id"?: number,"operator": string,"reason": string,"target_family"?: string | null,"target_profile"?: string | null
                  }
                  Update: {
                    "action"?: string,"at"?: string,"detail"?: NonNullable<Json>,"id"?: number,"operator"?: string,"reason"?: string,"target_family"?: string | null,"target_profile"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"answers": {
                  Row: {
                    "answered_at": string,"choice": string,"family_id": string,"id": string,"parent_id": string,"question_id": string,"session_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answered_at"?: string,"choice": string,"family_id": string,"id"?: string,"parent_id": string,"question_id": string,"session_date"?: string
                  }
                  Update: {
                    "answered_at"?: string,"choice"?: string,"family_id"?: string,"id"?: string,"parent_id"?: string,"question_id"?: string,"session_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "answers_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answers_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "answers_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "content_questions"
      referencedColumns: ["id"]
    }
                  ]
                },"cheer_texts": {
                  Row: {
                    "message_key": string,"text": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "message_key": string,"text": string,"updated_at"?: string
                  }
                  Update: {
                    "message_key"?: string,"text"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"cheers": {
                  Row: {
                    "family_id": string,"from_child": string,"id": string,"message_key": string,"notified_at": string | null,"read_at": string | null,"request_id": string | null,"sent_at": string,"to_parent": string
                  }
                  ComputedFields: never
                  Insert: {
                    "family_id": string,"from_child": string,"id"?: string,"message_key": string,"notified_at"?: string | null,"read_at"?: string | null,"request_id"?: string | null,"sent_at"?: string,"to_parent": string
                  }
                  Update: {
                    "family_id"?: string,"from_child"?: string,"id"?: string,"message_key"?: string,"notified_at"?: string | null,"read_at"?: string | null,"request_id"?: string | null,"sent_at"?: string,"to_parent"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "cheers_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cheers_from_child_fkey"
      columns: ["from_child"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "cheers_to_parent_fkey"
      columns: ["to_parent"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"consent_events": {
                  Row: {
                    "action": string,"at": string,"family_id": string,"id": number,"parent_id": string,"version": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"at"?: string,"family_id": string,"id"?: number,"parent_id": string,"version"?: string | null
                  }
                  Update: {
                    "action"?: string,"at"?: string,"family_id"?: string,"id"?: number,"parent_id"?: string,"version"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "consent_events_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "consent_events_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"content_photos": {
                  Row: {
                    "caption": string,"day_index": number,"id": string,"image_url": string,"keyword": string,"recall_questions": (string)[],"retired_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "caption": string,"day_index": number,"id"?: string,"image_url": string,"keyword": string,"recall_questions"?: (string)[],"retired_at"?: string | null
                  }
                  Update: {
                    "caption"?: string,"day_index"?: number,"id"?: string,"image_url"?: string,"keyword"?: string,"recall_questions"?: (string)[],"retired_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"content_questions": {
                  Row: {
                    "day_index": number,"id": string,"option_a": string,"option_b": string,"prompt": string | null,"retired_at": string | null,"starter_a": string | null,"starter_b": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "day_index": number,"id"?: string,"option_a": string,"option_b": string,"prompt"?: string | null,"retired_at"?: string | null,"starter_a"?: string | null,"starter_b"?: string | null
                  }
                  Update: {
                    "day_index"?: number,"id"?: string,"option_a"?: string,"option_b"?: string,"prompt"?: string | null,"retired_at"?: string | null,"starter_a"?: string | null,"starter_b"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"content_recall_options": {
                  Row: {
                    "day_index": number,"label": string,"slot": number
                  }
                  ComputedFields: never
                  Insert: {
                    "day_index": number,"label": string,"slot": number
                  }
                  Update: {
                    "day_index"?: number,"label"?: string,"slot"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "content_recall_options_day_index_fkey"
      columns: ["day_index"]
isOneToOne: false
      referencedRelation: "content_photos"
      referencedColumns: ["day_index"]
    }
                  ]
                },"daily_sessions": {
                  Row: {
                    "completed_at": string | null,"completed_steps": (string)[],"course_len": number,"day_index": number | null,"duration_sec": number,"family_id": string,"id": string,"parent_id": string,"photo_id": string | null,"question_id": string | null,"session_date": string,"skipped_steps": (string)[],"stopped_here": boolean,"word_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"completed_steps"?: (string)[],"course_len"?: number,"day_index"?: number | null,"duration_sec"?: number,"family_id": string,"id"?: string,"parent_id": string,"photo_id"?: string | null,"question_id"?: string | null,"session_date": string,"skipped_steps"?: (string)[],"stopped_here"?: boolean,"word_id"?: string | null
                  }
                  Update: {
                    "completed_at"?: string | null,"completed_steps"?: (string)[],"course_len"?: number,"day_index"?: number | null,"duration_sec"?: number,"family_id"?: string,"id"?: string,"parent_id"?: string,"photo_id"?: string | null,"question_id"?: string | null,"session_date"?: string,"skipped_steps"?: (string)[],"stopped_here"?: boolean,"word_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "daily_sessions_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_sessions_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_sessions_photo_id_fkey"
      columns: ["photo_id"]
isOneToOne: false
      referencedRelation: "content_photos"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_sessions_question_id_fkey"
      columns: ["question_id"]
isOneToOne: false
      referencedRelation: "content_questions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "daily_sessions_word_id_fkey"
      columns: ["word_id"]
isOneToOne: false
      referencedRelation: "content_photos"
      referencedColumns: ["id"]
    }
                  ]
                },"device_tokens": {
                  Row: {
                    "platform": string,"token": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "platform"?: string,"token": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "platform"?: string,"token"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"entitlements": {
                  Row: {
                    "created_at": string,"family_id": string,"id": string,"plan_id": string,"source": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"family_id": string,"id"?: string,"plan_id": string,"source": string,"valid_until"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"family_id"?: string,"id"?: string,"plan_id"?: string,"source"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "entitlements_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "entitlements_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "plans"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "actor_role": string,"device_key": string | null,"family_id": string | null,"id": number,"name": string,"profile_id": string | null,"props": NonNullable<Json>,"ts": string
                  }
                  ComputedFields: never
                  Insert: {
                    "actor_role": string,"device_key"?: string | null,"family_id"?: string | null,"id"?: number,"name": string,"profile_id"?: string | null,"props"?: NonNullable<Json>,"ts"?: string
                  }
                  Update: {
                    "actor_role"?: string,"device_key"?: string | null,"family_id"?: string | null,"id"?: number,"name"?: string,"profile_id"?: string | null,"props"?: NonNullable<Json>,"ts"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"families": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"is_review": boolean,"is_test": boolean,"parent_title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_review"?: boolean,"is_test"?: boolean,"parent_title"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"is_review"?: boolean,"is_test"?: boolean,"parent_title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"first_answer_notices": {
                  Row: {
                    "child_id": string,"created_at": string,"family_id": string,"reason": string | null,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"created_at"?: string,"family_id": string,"reason"?: string | null,"status": string,"updated_at"?: string
                  }
                  Update: {
                    "child_id"?: string,"created_at"?: string,"family_id"?: string,"reason"?: string | null,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "first_answer_notices_child_id_fkey"
      columns: ["child_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "first_answer_notices_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"invite_codes": {
                  Row: {
                    "code": string,"created_by": string,"disabled_at": string | null,"expires_at": string,"family_id": string,"id": string,"max_uses": number | null,"reusable": boolean,"target_profile_id": string | null,"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "code": string,"created_by": string,"disabled_at"?: string | null,"expires_at"?: string,"family_id": string,"id"?: string,"max_uses"?: number | null,"reusable"?: boolean,"target_profile_id"?: string | null,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "code"?: string,"created_by"?: string,"disabled_at"?: string | null,"expires_at"?: string,"family_id"?: string,"id"?: string,"max_uses"?: number | null,"reusable"?: boolean,"target_profile_id"?: string | null,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invite_codes_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invite_codes_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invite_codes_target_profile_id_fkey"
      columns: ["target_profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"kakao_unlink_queue": {
                  Row: {
                    "attempts": number,"enqueued_at": string,"gave_up_at": string | null,"id": number,"kakao_user_id": string,"last_http": number | null,"next_attempt_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"enqueued_at"?: string,"gave_up_at"?: string | null,"id"?: number,"kakao_user_id": string,"last_http"?: number | null,"next_attempt_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"enqueued_at"?: string,"gave_up_at"?: string | null,"id"?: number,"kakao_user_id"?: string,"last_http"?: number | null,"next_attempt_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notification_queue": {
                  Row: {
                    "created_at": string,"family_id": string,"id": number,"kind": string,"payload": NonNullable<Json>,"sent_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"family_id": string,"id"?: number,"kind": string,"payload"?: NonNullable<Json>,"sent_at"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"family_id"?: string,"id"?: number,"kind"?: string,"payload"?: NonNullable<Json>,"sent_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_queue_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"pass_on_picks": {
                  Row: {
                    "day_index": number,"family_id": string,"line_key": string,"parent_id": string,"picked_at": string,"session_date": string
                  }
                  ComputedFields: never
                  Insert: {
                    "day_index": number,"family_id": string,"line_key": string,"parent_id": string,"picked_at"?: string,"session_date": string
                  }
                  Update: {
                    "day_index"?: number,"family_id"?: string,"line_key"?: string,"parent_id"?: string,"picked_at"?: string,"session_date"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pass_on_picks_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pass_on_picks_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pass_on_picks_parent_id_session_date_fkey"
      columns: ["parent_id","session_date"]
isOneToOne: true
      referencedRelation: "daily_sessions"
      referencedColumns: ["parent_id","session_date"]
    }
                  ]
                },"plans": {
                  Row: {
                    "id": string,"name": string,"price_krw": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id": string,"name": string,"price_krw"?: number | null
                  }
                  Update: {
                    "id"?: string,"name"?: string,"price_krw"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "consent_version": string | null,"consented_at": string | null,"content_seq": number | null,"content_seq_date": string | null,"course_start_date": string,"created_at": string,"family_id": string,"id": string,"parent_title": string | null,"push_consented_at": string | null,"push_enabled": boolean,"role": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "consent_version"?: string | null,"consented_at"?: string | null,"content_seq"?: number | null,"content_seq_date"?: string | null,"course_start_date"?: string,"created_at"?: string,"family_id": string,"id"?: string,"parent_title"?: string | null,"push_consented_at"?: string | null,"push_enabled"?: boolean,"role": string,"user_id"?: string | null
                  }
                  Update: {
                    "consent_version"?: string | null,"consented_at"?: string | null,"content_seq"?: number | null,"content_seq_date"?: string | null,"course_start_date"?: string,"created_at"?: string,"family_id"?: string,"id"?: string,"parent_title"?: string | null,"push_consented_at"?: string | null,"push_enabled"?: boolean,"role"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "profiles_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    }
                  ]
                },"push_claims": {
                  Row: {
                    "claimed_at": string,"kind": string,"profile_id": string,"sent_on": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claimed_at"?: string,"kind": string,"profile_id": string,"sent_on": string,"status"?: string
                  }
                  Update: {
                    "claimed_at"?: string,"kind"?: string,"profile_id"?: string,"sent_on"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_claims_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"push_copy": {
                  Row: {
                    "body": string,"body_fallback": string | null,"body_many": string | null,"kind": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"body_fallback"?: string | null,"body_many"?: string | null,"kind": string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "body"?: string,"body_fallback"?: string | null,"body_many"?: string | null,"kind"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_log": {
                  Row: {
                    "created_at": string,"id": number,"kind": string,"profile_id": string,"sent_on": string,"status": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: number,"kind": string,"profile_id": string,"sent_on": string,"status": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: number,"kind"?: string,"profile_id"?: string,"sent_on"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "push_log_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"push_runs": {
                  Row: {
                    "excluded": number,"failed": number,"id": number,"invalid": number,"kind": string,"note": string | null,"run_at": string,"sent": number,"targets": number
                  }
                  ComputedFields: never
                  Insert: {
                    "excluded"?: number,"failed"?: number,"id"?: number,"invalid"?: number,"kind": string,"note"?: string | null,"run_at"?: string,"sent"?: number,"targets"?: number
                  }
                  Update: {
                    "excluded"?: number,"failed"?: number,"id"?: number,"invalid"?: number,"kind"?: string,"note"?: string | null,"run_at"?: string,"sent"?: number,"targets"?: number
                  }
                  Relationships: [
                    
                  ]
                },"recall_picks": {
                  Row: {
                    "day_index": number,"family_id": string,"parent_id": string,"picked_at": string,"session_date": string,"slot": number
                  }
                  ComputedFields: never
                  Insert: {
                    "day_index": number,"family_id": string,"parent_id": string,"picked_at"?: string,"session_date": string,"slot": number
                  }
                  Update: {
                    "day_index"?: number,"family_id"?: string,"parent_id"?: string,"picked_at"?: string,"session_date"?: string,"slot"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "recall_picks_day_index_slot_fkey"
      columns: ["day_index","slot"]
isOneToOne: false
      referencedRelation: "content_recall_options"
      referencedColumns: ["day_index","slot"]
    },{
      foreignKeyName: "recall_picks_family_id_fkey"
      columns: ["family_id"]
isOneToOne: false
      referencedRelation: "families"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recall_picks_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "recall_picks_parent_id_session_date_fkey"
      columns: ["parent_id","session_date"]
isOneToOne: true
      referencedRelation: "daily_sessions"
      referencedColumns: ["parent_id","session_date"]
    }
                  ]
                },"redeem_attempts": {
                  Row: {
                    "at": string,"id": number,"ok": boolean,"uid": string
                  }
                  ComputedFields: never
                  Insert: {
                    "at"?: string,"id"?: number,"ok": boolean,"uid": string
                  }
                  Update: {
                    "at"?: string,"id"?: number,"ok"?: boolean,"uid"?: string
                  }
                  Relationships: [
                    
                  ]
                },"server_flags": {
                  Row: {
                    "enabled": boolean,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "enabled"?: boolean,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "enabled"?: boolean,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"stale_purge_failures": {
                  Row: {
                    "failures": number,"last_failed_at": string,"last_sqlstate": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "failures"?: number,"last_failed_at"?: string,"last_sqlstate"?: string | null,"user_id": string
                  }
                  Update: {
                    "failures"?: number,"last_failed_at"?: string,"last_sqlstate"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"terms_agreements": {
                  Row: {
                    "agreed_at": string,"id": number,"privacy_version": string,"role": string,"terms_version": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "agreed_at"?: string,"id"?: number,"privacy_version": string,"role": string,"terms_version": string,"user_id": string
                  }
                  Update: {
                    "agreed_at"?: string,"id"?: number,"privacy_version"?: string,"role"?: string,"terms_version"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"terms_versions": {
                  Row: {
                    "kind": string,"published_at": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "kind": string,"published_at"?: string,"version": string
                  }
                  Update: {
                    "kind"?: string,"published_at"?: string,"version"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "content_runway": {
                  Row: {
                    "active_days": number | null,"max_cursor": number | null,"remaining_new_days": number | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                },"kakao_unlink_gave_up": {
                  Row: {
                    "attempts": number,"enqueued_at": string,"gave_up_at": string | null,"id": number,"last_http": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "attempts"?: number | null,"enqueued_at"?: string | null,"gave_up_at"?: string | null,"id"?: number | null,"last_http"?: number | null
                         }
                        Update: {
                           "attempts"?: number | null,"enqueued_at"?: string | null,"gave_up_at"?: string | null,"id"?: number | null,"last_http"?: number | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "account_delete_core":
{ Args: { "p_profile": string }; Returns: Json
                           },
"admin_check_args":
{ Args: { "p_operator": string,"p_reason": string }; Returns: undefined
                           },
"admin_cleanup_review_family":
{ Args: { "p_family": string }; Returns: Json
                           },
"admin_create_review_family":
{ Args: { "p_child_users": (string)[],"p_max_uses"?: number }; Returns: Json
                           },
"admin_delete_account":
{ Args: { "p_operator": string,"p_profile": string,"p_reason": string }; Returns: Json
                           },
"admin_delete_answers":
{ Args: { "p_operator": string,"p_profile": string,"p_reason": string }; Returns: Json
                           },
"admin_delete_user":
{ Args: { "p_operator": string,"p_reason": string,"p_user": string }; Returns: Json
                           },
"admin_kakao_unlink_resolve":
{ Args: { "p_id": number,"p_operator": string,"p_reason": string }; Returns: Json
                           },
"admin_kakao_unlink_retry":
{ Args: { "p_id": number,"p_operator": string,"p_reason": string }; Returns: Json
                           },
"admin_publish_content":
{ Args: { "p_days": Json,"p_operator": string,"p_reason": string }; Returns: Json
                           },
"admin_publish_terms_version":
{ Args: { "p_kind": string,"p_operator": string,"p_reason": string,"p_version": string }; Returns: Json
                           },
"admin_retire_content":
{ Args: { "p_day": number,"p_operator": string,"p_reason": string }; Returns: Json
                           },
"admin_set_review_code":
{ Args: { "p_enabled": boolean,"p_family": string }; Returns: number
                           },
"admin_set_test_family":
{ Args: { "p_family": string,"p_is_test": boolean,"p_operator": string,"p_reason": string }; Returns: Json
                           },
"advance_content_cursor":
{ Args: { "p_profile": string }; Returns: boolean
                           },
"anon_last_activity":
{ Args: { "p_user": string }; Returns: string
                           },
"cheer_key_ok":
{ Args: { "p_key": string }; Returns: boolean
                           },
"child_answer_history":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"child_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"choice_pair_prompt":
{ Args: { "p_a": string,"p_b": string }; Returns: string
                           },
"content_next_day":
{ Args: { "p_after": number }; Returns: number
                           },
"create_family":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"delete_scope_preview":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"dev_reset_today":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"discard_anonymous_session":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"event_device_key":
{ Args: { "p_uid": string }; Returns: string
                           },
"event_prop_ok":
{ Args: { "p_key": string,"p_val": Json }; Returns: boolean
                           },
"family_child_history":
{ Args: { "p_family": string,"p_parent": string }; Returns: Json
                           },
"family_child_summary":
{ Args: { "p_family": string,"p_parent": string }; Returns: Json
                           },
"first_answer_backfill":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"five_steps_skipped":
{ Args: { "p_parent": string,"p_step": string }; Returns: boolean
                           },
"get_my_cheers":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"get_today_content":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"give_consent":
{ Args: { "p_version": string }; Returns: undefined
                           },
"issue_invite_code":
{ Args: { "p_target"?: string }; Returns: string
                           },
"kakao_unlink_claim":
{ Args: { "p_limit"?: number,"p_now"?: string }; Returns: Json
                           },
"kakao_unlink_kick":
{ Args: { "p_now"?: string }; Returns: Json
                           },
"kakao_unlink_record":
{ Args: { "p_results": Json }; Returns: Json
                           },
"kakao_unlink_release":
{ Args: { "p_http"?: number,"p_ids": (number)[] }; Returns: Json
                           },
"kst_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"log_event":
{ Args: { "p_name": string,"p_props"?: Json }; Returns: Json
                           },
"mark_cheers_read":
{ Args: { "p_ids"?: (string)[] }; Returns: number
                           },
"my_consented":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"my_day_index":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"my_family_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_profile_id":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_push_settings":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_role":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"my_terms_status":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"my_week_stamps":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"parent_family_list":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"parent_history":
{ Args: { "p_days"?: number }; Returns: Json
                           },
"parent_preview_child_view":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"parent_streak":
{ Args: { "p_parent": string,"p_today"?: string }; Returns: number
                           },
"parent_titles":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"pass_on_key_ok":
{ Args: { "p_key": string }; Returns: boolean
                           },
"peek_invite_code":
{ Args: { "p_code": string }; Returns: Json
                           },
"preview_content":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"purge_expired_data":
{ Args: { "p_now"?: string }; Returns: Json
                           },
"purge_stale_anonymous":
{ Args: { "p_now"?: string }; Returns: Json
                           },
"push_channel":
{ Args: { "p_kind": string }; Returns: string
                           },
"push_daily_claim":
{ Args: { "p_now"?: string }; Returns: Json
                           },
"push_daily_eligible":
{ Args: { "p_today": string }; Returns: string[]
                           },
"push_daily_kick":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"push_daily_targets":
{ Args: { "p_now"?: string }; Returns: Json
                           },
"push_events_claim":
{ Args: { "p_now"?: string }; Returns: Json
                           },
"push_events_kick":
{ Args: { "p_now"?: string }; Returns: Json
                           },
"push_kick":
{ Args: { "p_function": string }; Returns: Json
                           },
"push_reachable":
{ Args: { "p_profile": string }; Returns: boolean
                           },
"push_record":
{ Args: { "p_excluded"?: number,"p_kind": string,"p_note"?: string,"p_now"?: string,"p_results": Json }; Returns: Json
                           },
"push_render":
{ Args: { "p_fallback"?: string,"p_template": string,"p_vars": Json }; Returns: string
                           },
"push_text_clean":
{ Args: { "p": string }; Returns: boolean
                           },
"record_session_step":
{ Args: { "p_course_len"?: number,"p_duration"?: number,"p_skipped"?: boolean,"p_step": string }; Returns: Json
                           },
"record_terms_agreement":
{ Args: { "p_privacy_version": string,"p_terms_version": string }; Returns: Json
                           },
"redeem_invite_code":
{ Args: { "p_code": string }; Returns: Json
                           },
"register_push_token":
{ Args: { "p_platform"?: string,"p_token": string }; Returns: Json
                           },
"save_answer":
{ Args: { "p_choice": string,"p_question": string }; Returns: undefined
                           },
"save_pass_on":
{ Args: { "p_day_index": number,"p_key": string }; Returns: Json
                           },
"save_recall":
{ Args: { "p_day_index": number,"p_slot": number }; Returns: Json
                           },
"send_cheer":
{ Args: { "p_key": string,"p_parent": string,"p_request_id"?: string }; Returns: Json
                           },
"server_flag":
{ Args: { "p_name": string }; Returns: boolean
                           },
"server_flag_seed_local":
{ Args: { "p_name": string }; Returns: boolean
                           },
"set_parent_title":
{ Args: { "p_title": string }; Returns: Json
                           },
"set_parent_title_for":
{ Args: { "p_parent": string,"p_title": string }; Returns: Json
                           },
"set_push_enabled":
{ Args: { "p_enabled": boolean }; Returns: Json
                           },
"stale_anon_days":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"stale_anonymous_users":
{ Args: { "p_limit"?: number,"p_now"?: string }; Returns: string[]
                           },
"start_today":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"unregister_push_token":
{ Args: { "p_token": string }; Returns: Json
                           },
"user_delete_core":
{ Args: { "p_user": string }; Returns: Json
                           } |
{ Args: { "p_event": string,"p_user": string }; Returns: Json
                           },
"week_stamps_for":
{ Args: { "p_parent": string,"p_today": string }; Returns: Json
                           },
"withdraw_consent":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const
