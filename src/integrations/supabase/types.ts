export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      endorsements: {
        Row: {
          comment: string | null
          created_at: string
          endorsed_id: string
          endorser_id: string
          id: string
          is_hidden: boolean | null
          pillar: Database["public"]["Enums"]["pillar_type"]
          stars: number
        }
        Insert: {
          comment?: string | null
          created_at?: string
          endorsed_id: string
          endorser_id: string
          id?: string
          is_hidden?: boolean | null
          pillar: Database["public"]["Enums"]["pillar_type"]
          stars: number
        }
        Update: {
          comment?: string | null
          created_at?: string
          endorsed_id?: string
          endorser_id?: string
          id?: string
          is_hidden?: boolean | null
          pillar?: Database["public"]["Enums"]["pillar_type"]
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "endorsements_endorsed_id_fkey"
            columns: ["endorsed_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "endorsements_endorser_id_fkey"
            columns: ["endorser_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          created_at: string
          description: string | null
          endorsement_id: string
          file_type: string | null
          file_url: string
          id: string
          uploader_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          endorsement_id: string
          file_type?: string | null
          file_url: string
          id?: string
          uploader_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          endorsement_id?: string
          file_type?: string | null
          file_url?: string
          id?: string
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_endorsement_id_fkey"
            columns: ["endorsement_id"]
            isOneToOne: false
            referencedRelation: "endorsements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          country: string | null
          country_code: string | null
          created_at: string
          custom_permissions: Database["public"]["Enums"]["app_permission"][]
          date_of_birth: string | null
          denied_permissions: Database["public"]["Enums"]["app_permission"][]
          full_name: string | null
          full_name_change_count: number | null
          full_name_last_changed_at: string | null
          granted_permissions: Database["public"]["Enums"]["app_permission"][]
          id: string
          is_admin: boolean | null
          is_verified: boolean | null
          language_code: string | null
          last_active_at: string | null
          official_id: string
          place_of_birth: string | null
          phone_country_code: string | null
          phone_e164: string | null
          phone_number: string | null
          role: Database["public"]["Enums"]["app_role"]
          sex: string | null
          social_security_number: string
          updated_at: string
          user_id: string
          username: string | null
          username_last_changed_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          custom_permissions?: Database["public"]["Enums"]["app_permission"][]
          date_of_birth?: string | null
          denied_permissions?: Database["public"]["Enums"]["app_permission"][]
          full_name?: string | null
          full_name_change_count?: number | null
          full_name_last_changed_at?: string | null
          granted_permissions?: Database["public"]["Enums"]["app_permission"][]
          id?: string
          is_admin?: boolean | null
          is_verified?: boolean | null
          language_code?: string | null
          last_active_at?: string | null
          official_id?: string
          place_of_birth?: string | null
          phone_country_code?: string | null
          phone_e164?: string | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          sex?: string | null
          social_security_number?: string
          updated_at?: string
          user_id: string
          username?: string | null
          username_last_changed_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          country?: string | null
          country_code?: string | null
          created_at?: string
          custom_permissions?: Database["public"]["Enums"]["app_permission"][]
          date_of_birth?: string | null
          denied_permissions?: Database["public"]["Enums"]["app_permission"][]
          full_name?: string | null
          full_name_change_count?: number | null
          full_name_last_changed_at?: string | null
          granted_permissions?: Database["public"]["Enums"]["app_permission"][]
          id?: string
          is_admin?: boolean | null
          is_verified?: boolean | null
          language_code?: string | null
          last_active_at?: string | null
          official_id?: string
          place_of_birth?: string | null
          phone_country_code?: string | null
          phone_e164?: string | null
          phone_number?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          sex?: string | null
          social_security_number?: string
          updated_at?: string
          user_id?: string
          username?: string | null
          username_last_changed_at?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          created_at: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          permission: Database["public"]["Enums"]["app_permission"]
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          permission?: Database["public"]["Enums"]["app_permission"]
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_notes: string | null
          created_at: string
          endorsement_id: string | null
          id: string
          reason: string
          reported_user_id: string | null
          reporter_id: string
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          endorsement_id?: string | null
          id?: string
          reason: string
          reported_user_id?: string | null
          reporter_id: string
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          endorsement_id?: string | null
          id?: string
          reason?: string
          reported_user_id?: string | null
          reporter_id?: string
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_endorsement_id_fkey"
            columns: ["endorsement_id"]
            isOneToOne: false
            referencedRelation: "endorsements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      law_articles: {
        Row: {
          body: string | null
          created_at: string
          id: string
          label: string
          section_id: string
          slug: string
          sort_order: number
          summary: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          label: string
          section_id: string
          slug: string
          sort_order?: number
          summary: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          label?: string
          section_id?: string
          slug?: string
          sort_order?: number
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "law_articles_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "law_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      law_contributions: {
        Row: {
          author_id: string
          contribution_type: Database["public"]["Enums"]["law_contribution_type"]
          created_at: string
          id: string
          note: string
          reviewed_at: string | null
          reviewer_id: string | null
          reviewer_notes: string | null
          source_id: string | null
          source_reference: string | null
          status: Database["public"]["Enums"]["law_contribution_status"]
          title: string
          track: Database["public"]["Enums"]["law_track"]
          updated_at: string
        }
        Insert: {
          author_id: string
          contribution_type: Database["public"]["Enums"]["law_contribution_type"]
          created_at?: string
          id?: string
          note: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          source_id?: string | null
          source_reference?: string | null
          status?: Database["public"]["Enums"]["law_contribution_status"]
          title: string
          track: Database["public"]["Enums"]["law_track"]
          updated_at?: string
        }
        Update: {
          author_id?: string
          contribution_type?: Database["public"]["Enums"]["law_contribution_type"]
          created_at?: string
          id?: string
          note?: string
          reviewed_at?: string | null
          reviewer_id?: string | null
          reviewer_notes?: string | null
          source_id?: string | null
          source_reference?: string | null
          status?: Database["public"]["Enums"]["law_contribution_status"]
          title?: string
          track?: Database["public"]["Enums"]["law_track"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "law_contributions_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "law_contributions_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "law_contributions_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "law_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      law_sections: {
        Row: {
          created_at: string
          id: string
          slug: string
          sort_order: number
          source_id: string
          summary: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          slug: string
          sort_order?: number
          source_id: string
          summary: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          slug?: string
          sort_order?: number
          source_id?: string
          summary?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "law_sections_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "law_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      law_sources: {
        Row: {
          created_at: string
          domain: string
          id: string
          instrument: string
          is_published: boolean
          jurisdiction: string
          slug: string
          sort_order: number
          source_url: string | null
          summary: string
          title: string
          track: Database["public"]["Enums"]["law_track"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          instrument: string
          is_published?: boolean
          jurisdiction: string
          slug: string
          sort_order?: number
          source_url?: string | null
          summary: string
          title: string
          track: Database["public"]["Enums"]["law_track"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          instrument?: string
          is_published?: boolean
          jurisdiction?: string
          slug?: string
          sort_order?: number
          source_url?: string | null
          summary?: string
          title?: string
          track?: Database["public"]["Enums"]["law_track"]
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_edited: boolean | null
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_edited: boolean | null
          post_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          post_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_edited: boolean | null
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      resolve_login_email: {
        Args: { identifier: string }
        Returns: string | null
      }
    }
    Enums: {
      app_permission:
        | "law.read"
        | "law.contribute"
        | "law.review"
        | "build.use"
        | "profile.read"
        | "profile.update_self"
        | "profile.update_any"
        | "post.create"
        | "post.edit_self"
        | "post.delete_self"
        | "post.moderate"
        | "comment.create"
        | "comment.edit_self"
        | "comment.delete_self"
        | "comment.moderate"
        | "message.create"
        | "message.edit_self"
        | "message.moderate"
        | "endorsement.create"
        | "endorsement.review"
        | "endorsement.moderate"
        | "report.create"
        | "report.review"
        | "market.manage"
        | "role.assign"
        | "settings.manage"
        | "like.create"
        | "like.delete_self"
      app_role:
        | "guest"
        | "member"
        | "verified_member"
        | "moderator"
        | "market_manager"
        | "founder"
        | "admin"
        | "system"
      law_contribution_status:
        | "pending"
        | "approved"
        | "changes_requested"
        | "rejected"
      law_contribution_type:
        | "source"
        | "structure"
        | "summary"
      law_track:
        | "civil"
        | "criminal"
      pillar_type:
        | "education_skills"
        | "culture_ethics"
        | "responsibility_reliability"
        | "environment_community"
        | "economy_contribution"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
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
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_permission: [
        "build.use",
        "profile.read",
        "profile.update_self",
        "profile.update_any",
        "post.create",
        "post.edit_self",
        "post.delete_self",
        "post.moderate",
        "comment.create",
        "comment.edit_self",
        "comment.delete_self",
        "comment.moderate",
        "message.create",
        "message.edit_self",
        "message.moderate",
        "endorsement.create",
        "endorsement.review",
        "endorsement.moderate",
        "report.create",
        "report.review",
        "market.manage",
        "role.assign",
        "settings.manage",
        "like.create",
        "like.delete_self",
      ],
      app_role: [
        "guest",
        "member",
        "verified_member",
        "moderator",
        "market_manager",
        "founder",
        "admin",
        "system",
      ],
      pillar_type: [
        "education_skills",
        "culture_ethics",
        "responsibility_reliability",
        "environment_community",
        "economy_contribution",
      ],
    },
  },
} as const
