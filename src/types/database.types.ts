export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

/**
 * Minimal generated-style typings for tables this app touches.
 * Regenerate from Supabase CLI when the schema grows.
 */
export type Database = {
  public: {
    Tables: {
      audit_events: {
        Row: {
          id: string;
          action: string;
          actor_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          action: string;
          actor_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          action?: string;
          actor_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          role: string;
          full_name: string | null;
          email: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role: string;
          full_name?: string | null;
          email?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: string;
          full_name?: string | null;
          email?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      school_settings: {
        Row: {
          id: string;
          school_name: string;
          logo_storage_path: string | null;
          school_address: string;
          school_phone: string;
          school_email: string;
          website: string;
          primary_color: string;
          secondary_color: string;
          report_card_footer: string;
          principal_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_name?: string;
          logo_storage_path?: string | null;
          school_address?: string;
          school_phone?: string;
          school_email?: string;
          website?: string;
          primary_color?: string;
          secondary_color?: string;
          report_card_footer?: string;
          principal_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_name?: string;
          logo_storage_path?: string | null;
          school_address?: string;
          school_phone?: string;
          school_email?: string;
          website?: string;
          primary_color?: string;
          secondary_color?: string;
          report_card_footer?: string;
          principal_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      report_card_files: {
        Row: {
          id: string;
          student_id: string;
          school_year: string;
          term: string;
          storage_path: string;
          title: string | null;
          uploaded_by: string | null;
          status: "draft" | "final" | "archive";
          source: "uploaded" | "generated";
          voided_at: string | null;
          voided_by: string | null;
          void_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          school_year: string;
          term: string;
          storage_path: string;
          title?: string | null;
          uploaded_by?: string | null;
          status?: "draft" | "final" | "archive";
          source?: "uploaded" | "generated";
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          school_year?: string;
          term?: string;
          storage_path?: string;
          title?: string | null;
          uploaded_by?: string | null;
          status?: "draft" | "final" | "archive";
          source?: "uploaded" | "generated";
          voided_at?: string | null;
          voided_by?: string | null;
          void_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      report_card_comments: {
        Row: {
          id: string;
          student_id: string;
          class_id: string;
          school_year_id: string;
          term: string;
          narrative_comment: string;
          status: "draft" | "complete";
          teacher_profile_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          class_id: string;
          school_year_id: string;
          term: string;
          narrative_comment?: string;
          status?: "draft" | "complete";
          teacher_profile_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          class_id?: string;
          school_year_id?: string;
          term?: string;
          narrative_comment?: string;
          status?: "draft" | "complete";
          teacher_profile_id?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      student_interventions: {
        Row: {
          id: string;
          student_id: string;
          class_id: string;
          school_year_id: string;
          intervention_type: string;
          status: string;
          severity: string;
          title: string;
          description: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          resolved_at: string | null;
          follow_up_date: string | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          class_id: string;
          school_year_id: string;
          intervention_type: string;
          status?: string;
          severity?: string;
          title: string;
          description?: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
          follow_up_date?: string | null;
        };
        Update: {
          id?: string;
          student_id?: string;
          class_id?: string;
          school_year_id?: string;
          intervention_type?: string;
          status?: string;
          severity?: string;
          title?: string;
          description?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          resolved_at?: string | null;
          follow_up_date?: string | null;
        };
        Relationships: [];
      };
      attendance_records: {
        Row: {
          id: string;
          student_id: string;
          class_id: string;
          school_year: string;
          attendance_date: string;
          status: "present" | "absent" | "tardy" | "excused" | "partial";
          notes: string | null;
          recorded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          class_id: string;
          school_year: string;
          attendance_date: string;
          status: "present" | "absent" | "tardy" | "excused" | "partial";
          notes?: string | null;
          recorded_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          class_id?: string;
          school_year?: string;
          attendance_date?: string;
          status?: "present" | "absent" | "tardy" | "excused" | "partial";
          notes?: string | null;
          recorded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      behavior_records: {
        Row: {
          id: string;
          student_id: string;
          class_id: string;
          school_year: string;
          behavior_date: string;
          behavior_type:
            | "positive_recognition"
            | "classroom_concern"
            | "behavior_incident"
            | "participation"
            | "social_emotional"
            | "parent_contact"
            | "intervention_followup";
          severity: "positive" | "low" | "medium" | "high";
          title: string;
          description: string;
          action_taken: string | null;
          recorded_by: string;
          support_category: string | null;
          support_tags: string[];
          generated_summary: string | null;
          teacher_note: string | null;
          follow_up_required: boolean;
          parent_contacted: boolean | null;
          time_of_day: string | null;
          related_subject: string | null;
          quick_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          class_id: string;
          school_year: string;
          behavior_date: string;
          behavior_type:
            | "positive_recognition"
            | "classroom_concern"
            | "behavior_incident"
            | "participation"
            | "social_emotional"
            | "parent_contact"
            | "intervention_followup";
          severity: "positive" | "low" | "medium" | "high";
          title: string;
          description?: string;
          action_taken?: string | null;
          recorded_by: string;
          support_category?: string | null;
          support_tags?: string[];
          generated_summary?: string | null;
          teacher_note?: string | null;
          follow_up_required?: boolean;
          parent_contacted?: boolean | null;
          time_of_day?: string | null;
          related_subject?: string | null;
          quick_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          student_id?: string;
          class_id?: string;
          school_year?: string;
          behavior_date?: string;
          behavior_type?:
            | "positive_recognition"
            | "classroom_concern"
            | "behavior_incident"
            | "participation"
            | "social_emotional"
            | "parent_contact"
            | "intervention_followup";
          severity?: "positive" | "low" | "medium" | "high";
          title?: string;
          description?: string;
          action_taken?: string | null;
          recorded_by?: string;
          support_category?: string | null;
          support_tags?: string[];
          generated_summary?: string | null;
          teacher_note?: string | null;
          follow_up_required?: boolean;
          parent_contacted?: boolean | null;
          time_of_day?: string | null;
          related_subject?: string | null;
          quick_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      students: {
        Row: {
          id: string;
          first_name: string;
          last_name: string;
          preferred_name: string | null;
          external_id: string | null;
        };
        Insert: {
          id?: string;
          first_name: string;
          last_name: string;
          preferred_name?: string | null;
          external_id?: string | null;
        };
        Update: {
          first_name?: string;
          last_name?: string;
          preferred_name?: string | null;
          external_id?: string | null;
        };
        Relationships: [];
      };
      class_teachers: {
        Row: {
          id: string;
          class_id: string;
          teacher_profile_id: string;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          teacher_profile_id: string;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          class_id?: string;
          teacher_profile_id?: string;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      classes: {
        Row: {
          id: string;
          school_year_id: string;
          grade_level_id: string;
          name: string;
          section: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school_year_id: string;
          grade_level_id: string;
          name: string;
          section?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          school_year_id?: string;
          grade_level_id?: string;
          name?: string;
          section?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classes_school_year_id_fkey";
            columns: ["school_year_id"];
            isOneToOne: false;
            referencedRelation: "school_years";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "classes_grade_level_id_fkey";
            columns: ["grade_level_id"];
            isOneToOne: false;
            referencedRelation: "grade_levels";
            referencedColumns: ["id"];
          },
        ];
      };
      grade_levels: {
        Row: {
          id: string;
          name: string;
          sort_order: number;
          code: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          sort_order: number;
          code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          sort_order?: number;
          code?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      gradebook_categories: {
        Row: {
          id: string;
          class_id: string;
          teacher_profile_id: string;
          name: string;
          weight_percent: number;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          teacher_profile_id: string;
          name: string;
          weight_percent: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          weight_percent?: number;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gradebook_categories_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      gradebook_assignments: {
        Row: {
          id: string;
          class_id: string;
          category_id: string;
          teacher_profile_id: string;
          title: string;
          description: string | null;
          points_possible: number;
          due_date: string | null;
          term: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          class_id: string;
          category_id: string;
          teacher_profile_id: string;
          title: string;
          description?: string | null;
          points_possible: number;
          due_date?: string | null;
          term?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          title?: string;
          description?: string | null;
          points_possible?: number;
          due_date?: string | null;
          term?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gradebook_assignments_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "gradebook_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gradebook_assignments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      gradebook_scores: {
        Row: {
          id: string;
          assignment_id: string;
          student_id: string;
          points_earned: number | null;
          status: "scored" | "missing" | "exempt" | "absent";
          feedback: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          assignment_id: string;
          student_id: string;
          points_earned?: number | null;
          status?: "scored" | "missing" | "exempt" | "absent";
          feedback?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          points_earned?: number | null;
          status?: "scored" | "missing" | "exempt" | "absent";
          feedback?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "gradebook_scores_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "gradebook_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "gradebook_scores_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      academic_records: {
        Row: {
          id: string;
          student_id: string;
          class_id: string;
          subject: string;
          term: string | null;
          score_or_grade: string | null;
          performance_level: string | null;
          teacher_comment: string | null;
          work_habits: string | null;
          teacher_profile_id: string;
          school_year_id: string;
          status: "draft" | "submitted" | "reviewed" | "archived";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          class_id: string;
          subject: string;
          term?: string | null;
          score_or_grade?: string | null;
          performance_level?: string | null;
          teacher_comment?: string | null;
          work_habits?: string | null;
          teacher_profile_id: string;
          school_year_id: string;
          status?: "draft" | "submitted" | "reviewed" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          subject?: string;
          term?: string | null;
          score_or_grade?: string | null;
          performance_level?: string | null;
          teacher_comment?: string | null;
          work_habits?: string | null;
          status?: "draft" | "submitted" | "reviewed" | "archived";
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "academic_records_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "academic_records_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_enrollments: {
        Row: {
          id: string;
          student_id: string;
          class_id: string;
          school_year_id: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          class_id: string;
          school_year_id: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          class_id?: string;
          school_year_id?: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_enrollments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      transition_notes: {
        Row: {
          id: string;
          student_id: string;
          author_profile_id: string;
          school_year_id: string | null;
          status: string;
          reviewed_at: string | null;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
          academic_strengths: string;
          academic_needs: string;
          reading_notes: string;
          writing_notes: string;
          math_notes: string;
          english_language_notes: string;
          learning_habits: string;
          social_emotional_notes: string;
          successful_strategies: string;
          recommended_next_steps: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          author_profile_id: string;
          school_year_id?: string | null;
          status?: string;
          reviewed_at?: string | null;
          archived_at?: string | null;
          academic_strengths?: string;
          academic_needs?: string;
          reading_notes?: string;
          writing_notes?: string;
          math_notes?: string;
          english_language_notes?: string;
          learning_habits?: string;
          social_emotional_notes?: string;
          successful_strategies?: string;
          recommended_next_steps?: string;
        };
        Update: {
          school_year_id?: string | null;
          status?: string;
          reviewed_at?: string | null;
          archived_at?: string | null;
          academic_strengths?: string;
          academic_needs?: string;
          reading_notes?: string;
          writing_notes?: string;
          math_notes?: string;
          english_language_notes?: string;
          learning_habits?: string;
          social_emotional_notes?: string;
          successful_strategies?: string;
          recommended_next_steps?: string;
        };
        Relationships: [];
      };
      parent_record_requests: {
        Row: {
          id: string;
          student_id: string;
          status: string;
          requester_name: string;
          requester_email: string;
          requester_relationship: string;
          requested_documents: string[];
          assigned_to_profile_id: string | null;
          details: string | null;
          staff_notes: string | null;
          submitted_by_profile_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          student_id: string;
          requester_name: string;
          requester_email: string;
          requester_relationship?: string;
          requested_documents?: string[];
          assigned_to_profile_id?: string | null;
          details?: string | null;
          staff_notes?: string | null;
          submitted_by_profile_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          student_id?: string;
          requester_name?: string;
          requester_email?: string;
          requester_relationship?: string;
          requested_documents?: string[];
          assigned_to_profile_id?: string | null;
          details?: string | null;
          staff_notes?: string | null;
          submitted_by_profile_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_invitations: {
        Row: {
          id: string;
          email: string;
          full_name: string;
          role: string;
          status: "pending" | "accepted" | "expired" | "cancelled";
          invited_by: string;
          accepted_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          full_name: string;
          role: string;
          status?: "pending" | "accepted" | "expired" | "cancelled";
          invited_by: string;
          accepted_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string;
          role?: string;
          status?: "pending" | "accepted" | "expired" | "cancelled";
          invited_by?: string;
          accepted_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      school_years: {
        Row: {
          id: string;
          label: string;
          starts_on: string;
          ends_on: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          label: string;
          starts_on: string;
          ends_on: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          label?: string;
          starts_on?: string;
          ends_on?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      teacher_bulk_create_students_for_class: {
        Args: {
          p_class_id: string;
          p_students: Json;
        };
        Returns: Json;
      };
      teacher_can_access_student: {
        Args: { p_student_id: string };
        Returns: boolean;
      };
      teacher_create_student_for_class: {
        Args: {
          p_class_id: string;
          p_first_name: string;
          p_last_name: string;
          p_preferred_name?: string | null;
        };
        Returns: string;
      };
      teacher_is_assigned_to_class: {
        Args: { p_class_id: string };
        Returns: boolean;
      };
      student_is_active_in_class: {
        Args: { p_student_id: string; p_class_id: string };
        Returns: boolean;
      };
      class_is_deletable: {
        Args: { p_class_id: string };
        Returns: boolean;
      };
      school_settings_report_branding: {
        Args: Record<string, never>;
        Returns: {
          school_name: string;
          logo_storage_path: string | null;
          school_address: string;
          school_phone: string;
          school_email: string;
          website: string;
          primary_color: string;
          secondary_color: string;
          report_card_footer: string;
          principal_name: string;
        }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
