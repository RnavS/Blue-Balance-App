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
      beverages: {
        Row: {
          created_at: string
          hydration_factor: number
          icon: string | null
          id: string
          is_default: boolean
          name: string
          profile_id: string
          serving_size: number
        }
        Insert: {
          created_at?: string
          hydration_factor?: number
          icon?: string | null
          id?: string
          is_default?: boolean
          name: string
          profile_id: string
          serving_size?: number
        }
        Update: {
          created_at?: string
          hydration_factor?: number
          icon?: string | null
          id?: string
          is_default?: boolean
          name?: string
          profile_id?: string
          serving_size?: number
        }
        Relationships: [
          {
            foreignKeyName: "beverages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          profile_id: string
          role: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          profile_id: string
          role: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: string
          age: number | null
          created_at: string
          custom_accent_color: string | null
          daily_goal: number
          first_name: string | null
          gradient_preset: string | null
          height: number | null
          id: string
          interval_length: number
          last_name: string | null
          quiet_hours_end: string
          quiet_hours_start: string
          reminder_interval: number
          reminders_enabled: boolean
          sleep_time: string
          sound_enabled: boolean
          theme: string
          unit_preference: string
          updated_at: string
          user_id: string
          username: string
          vibration_enabled: boolean
          wake_time: string
          weight: number | null
        }
        Insert: {
          activity_level?: string
          age?: number | null
          created_at?: string
          custom_accent_color?: string | null
          daily_goal?: number
          first_name?: string | null
          gradient_preset?: string | null
          height?: number | null
          id?: string
          interval_length?: number
          last_name?: string | null
          quiet_hours_end?: string
          quiet_hours_start?: string
          reminder_interval?: number
          reminders_enabled?: boolean
          sleep_time?: string
          sound_enabled?: boolean
          theme?: string
          unit_preference?: string
          updated_at?: string
          user_id: string
          username: string
          vibration_enabled?: boolean
          wake_time?: string
          weight?: number | null
        }
        Update: {
          activity_level?: string
          age?: number | null
          created_at?: string
          custom_accent_color?: string | null
          daily_goal?: number
          first_name?: string | null
          gradient_preset?: string | null
          height?: number | null
          id?: string
          interval_length?: number
          last_name?: string | null
          quiet_hours_end?: string
          quiet_hours_start?: string
          reminder_interval?: number
          reminders_enabled?: boolean
          sleep_time?: string
          sound_enabled?: boolean
          theme?: string
          unit_preference?: string
          updated_at?: string
          user_id?: string
          username?: string
          vibration_enabled?: boolean
          wake_time?: string
          weight?: number | null
        }
        Relationships: []
      }
      scanned_beverages: {
        Row: {
          barcode: string
          created_at: string
          hydration_factor: number
          id: string
          name: string
          profile_id: string
          serving_size: number
        }
        Insert: {
          barcode: string
          created_at?: string
          hydration_factor?: number
          id?: string
          name: string
          profile_id: string
          serving_size: number
        }
        Update: {
          barcode?: string
          created_at?: string
          hydration_factor?: number
          id?: string
          name?: string
          profile_id?: string
          serving_size?: number
        }
        Relationships: [
          {
            foreignKeyName: "scanned_beverages_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      water_logs: {
        Row: {
          amount: number
          created_at: string
          drink_type: string
          id: string
          logged_at: string
          profile_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          drink_type?: string
          id?: string
          logged_at?: string
          profile_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          drink_type?: string
          id?: string
          logged_at?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_logs_profile_id_fkey"
            columns: ["profile_id"]
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
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const