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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alert_events: {
        Row: {
          alert_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          payload: Json | null
          severity: string
          user_id: string
        }
        Insert: {
          alert_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          payload?: Json | null
          severity?: string
          user_id: string
        }
        Update: {
          alert_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          payload?: Json | null
          severity?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_events_alert_id_fkey"
            columns: ["alert_id"]
            isOneToOne: false
            referencedRelation: "alerts"
            referencedColumns: ["id"]
          },
        ]
      }
      alerts: {
        Row: {
          created_at: string
          entity_type: string
          id: string
          is_active: boolean
          keyword: string
          last_triggered_at: string | null
          name: string
          threshold: number
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity_type?: string
          id?: string
          is_active?: boolean
          keyword: string
          last_triggered_at?: string | null
          name: string
          threshold?: number
          trigger_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          is_active?: boolean
          keyword?: string
          last_triggered_at?: string | null
          name?: string
          threshold?: number
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          created_at: string
          env_var: string | null
          id: string
          is_enabled: boolean
          key: string
          kind: string
          name: string
          requires_key: boolean
        }
        Insert: {
          created_at?: string
          env_var?: string | null
          id?: string
          is_enabled?: boolean
          key: string
          kind: string
          name: string
          requires_key?: boolean
        }
        Update: {
          created_at?: string
          env_var?: string | null
          id?: string
          is_enabled?: boolean
          key?: string
          kind?: string
          name?: string
          requires_key?: boolean
        }
        Relationships: []
      }
      feed_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          payload: Json
          updated_at: string
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          payload: Json
          updated_at?: string
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      item_metrics_daily: {
        Row: {
          created_at: string
          day: string
          engagement: number
          id: string
          keyword: string
          kind: string
          negative: number
          neutral: number
          positive: number
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          day: string
          engagement?: number
          id?: string
          keyword: string
          kind?: string
          negative?: number
          neutral?: number
          positive?: number
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          day?: string
          engagement?: number
          id?: string
          keyword?: string
          kind?: string
          negative?: number
          neutral?: number
          positive?: number
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      keyword_watchlist: {
        Row: {
          country: string
          created_at: string
          id: string
          is_active: boolean
          keyword: string
          language: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keyword: string
          language?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          id?: string
          is_active?: boolean
          keyword?: string
          language?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      monitored_items: {
        Row: {
          ai_sentiment: string | null
          ai_sentiment_confidence: number | null
          ai_summary: string | null
          ai_topic: string | null
          author: string | null
          category: string | null
          comments: number
          country: string | null
          created_at: string
          engagement: number
          first_seen_at: string
          id: string
          image_url: string | null
          keywords: string[]
          kind: string
          language: string | null
          last_seen_at: string
          likes: number
          published_at: string | null
          sentiment: string | null
          sentiment_score: number | null
          shares: number
          source: string | null
          source_key: string | null
          summary: string
          title: string
          updated_at: string
          url: string
          url_key: string
        }
        Insert: {
          ai_sentiment?: string | null
          ai_sentiment_confidence?: number | null
          ai_summary?: string | null
          ai_topic?: string | null
          author?: string | null
          category?: string | null
          comments?: number
          country?: string | null
          created_at?: string
          engagement?: number
          first_seen_at?: string
          id?: string
          image_url?: string | null
          keywords?: string[]
          kind?: string
          language?: string | null
          last_seen_at?: string
          likes?: number
          published_at?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          shares?: number
          source?: string | null
          source_key?: string | null
          summary?: string
          title: string
          updated_at?: string
          url: string
          url_key: string
        }
        Update: {
          ai_sentiment?: string | null
          ai_sentiment_confidence?: number | null
          ai_summary?: string | null
          ai_topic?: string | null
          author?: string | null
          category?: string | null
          comments?: number
          country?: string | null
          created_at?: string
          engagement?: number
          first_seen_at?: string
          id?: string
          image_url?: string | null
          keywords?: string[]
          kind?: string
          language?: string | null
          last_seen_at?: string
          likes?: number
          published_at?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          shares?: number
          source?: string | null
          source_key?: string | null
          summary?: string
          title?: string
          updated_at?: string
          url?: string
          url_key?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_articles: {
        Row: {
          author: string | null
          category: string | null
          comments: number | null
          country: string | null
          created_at: string
          engagement: number | null
          id: string
          image_url: string | null
          kind: string
          language: string | null
          likes: number | null
          published_at: string | null
          sentiment: string | null
          sentiment_score: number | null
          shares: number | null
          source: string | null
          summary: string | null
          title: string
          url: string
          user_id: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          comments?: number | null
          country?: string | null
          created_at?: string
          engagement?: number | null
          id?: string
          image_url?: string | null
          kind?: string
          language?: string | null
          likes?: number | null
          published_at?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          shares?: number | null
          source?: string | null
          summary?: string | null
          title: string
          url: string
          user_id: string
        }
        Update: {
          author?: string | null
          category?: string | null
          comments?: number | null
          country?: string | null
          created_at?: string
          engagement?: number | null
          id?: string
          image_url?: string | null
          kind?: string
          language?: string | null
          likes?: number | null
          published_at?: string | null
          sentiment?: string | null
          sentiment_score?: number | null
          shares?: number | null
          source?: string | null
          summary?: string | null
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      search_history: {
        Row: {
          created_at: string
          id: string
          query: string
          results_count: number | null
          scope: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          query: string
          results_count?: number | null
          scope?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          query?: string
          results_count?: number | null
          scope?: string
          user_id?: string
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          created_at: string
          detail: Json | null
          event: string
          id: string
          level: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          detail?: Json | null
          event: string
          id?: string
          level?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          detail?: Json | null
          event?: string
          id?: string
          level?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const