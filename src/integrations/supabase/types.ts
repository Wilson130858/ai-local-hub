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
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_vouchers: {
        Row: {
          code: string
          created_at: string
          created_by: string
          id: string
          is_paused: boolean
          is_used: boolean
          max_uses: number | null
          used_at: string | null
          used_by: string | null
          uses_count: number
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          id?: string
          is_paused?: boolean
          is_used?: boolean
          max_uses?: number | null
          used_at?: string | null
          used_by?: string | null
          uses_count?: number
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          id?: string
          is_paused?: boolean
          is_used?: boolean
          max_uses?: number | null
          used_at?: string | null
          used_by?: string | null
          uses_count?: number
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "credit_vouchers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_vouchers_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          amount: number
          created_at: string
          description: string
          id: string
          invoice_id: string
          kind: Database["public"]["Enums"]["invoice_item_kind"]
          quote_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          description: string
          id?: string
          invoice_id: string
          kind: Database["public"]["Enums"]["invoice_item_kind"]
          quote_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string
          id?: string
          invoice_id?: string
          kind?: Database["public"]["Enums"]["invoice_item_kind"]
          quote_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "service_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          base_amount: number
          closed_at: string | null
          created_at: string
          due_date: string
          extras_amount: number
          id: string
          period_end: string
          period_start: string
          status: Database["public"]["Enums"]["invoice_status"]
          tenant_id: string
          total_amount: number
        }
        Insert: {
          base_amount?: number
          closed_at?: string | null
          created_at?: string
          due_date: string
          extras_amount?: number
          id?: string
          period_end: string
          period_start: string
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id: string
          total_amount?: number
        }
        Update: {
          base_amount?: number
          closed_at?: string | null
          created_at?: string
          due_date?: string
          extras_amount?: number
          id?: string
          period_end?: string
          period_start?: string
          status?: Database["public"]["Enums"]["invoice_status"]
          tenant_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          created_at: string
          id: string
          name: string
          origin: string | null
          original_query: string | null
          phone: string
          status: Database["public"]["Enums"]["lead_status"]
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          origin?: string | null
          original_query?: string | null
          phone: string
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          origin?: string | null
          original_query?: string | null
          phone?: string
          status?: Database["public"]["Enums"]["lead_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leads_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_read: boolean
          message: string
          target_user_id: string
          title: string
          type: Database["public"]["Enums"]["notification_type"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          message: string
          target_user_id: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_read?: boolean
          message?: string
          target_user_id?: string
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
        }
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          category: string | null
          created_at: string
          credits: number
          dashboard_widgets: Json
          full_name: string | null
          id: string
          status: Database["public"]["Enums"]["profile_status"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          category?: string | null
          created_at?: string
          credits?: number
          dashboard_widgets?: Json
          full_name?: string | null
          id: string
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          category?: string | null
          created_at?: string
          credits?: number
          dashboard_widgets?: Json
          full_name?: string | null
          id?: string
          status?: Database["public"]["Enums"]["profile_status"]
          updated_at?: string
        }
        Relationships: []
      }
      service_quotes: {
        Row: {
          amount: number
          billing_type: Database["public"]["Enums"]["quote_billing_type"]
          created_at: string
          created_by: string
          decided_at: string | null
          description: string | null
          id: string
          name: string
          proposed_billing_day: number | null
          proration_amount: number | null
          recurrence_months: number | null
          status: Database["public"]["Enums"]["quote_status"]
          tenant_id: string
        }
        Insert: {
          amount: number
          billing_type: Database["public"]["Enums"]["quote_billing_type"]
          created_at?: string
          created_by: string
          decided_at?: string | null
          description?: string | null
          id?: string
          name: string
          proposed_billing_day?: number | null
          proration_amount?: number | null
          recurrence_months?: number | null
          status?: Database["public"]["Enums"]["quote_status"]
          tenant_id: string
        }
        Update: {
          amount?: number
          billing_type?: Database["public"]["Enums"]["quote_billing_type"]
          created_at?: string
          created_by?: string
          decided_at?: string | null
          description?: string | null
          id?: string
          name?: string
          proposed_billing_day?: number | null
          proration_amount?: number | null
          recurrence_months?: number | null
          status?: Database["public"]["Enums"]["quote_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_quotes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          ai_config: Json
          billing_day: number
          business_name: string
          created_at: string
          google_calendar_token: string | null
          id: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          ai_config?: Json
          billing_day?: number
          business_name: string
          created_at?: string
          google_calendar_token?: string | null
          id?: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          ai_config?: Json
          billing_day?: number
          business_name?: string
          created_at?: string
          google_calendar_token?: string | null
          id?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenants_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          role: Database["public"]["Enums"]["app_role"]
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
      voucher_redemptions: {
        Row: {
          redeemed_at: string
          user_id: string
          value_at_redemption: number
          voucher_id: string
        }
        Insert: {
          redeemed_at?: string
          user_id: string
          value_at_redemption: number
          voucher_id: string
        }
        Update: {
          redeemed_at?: string
          user_id?: string
          value_at_redemption?: number
          voucher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_redemptions_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "credit_vouchers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decide_quote: {
        Args: { _decision: string; _quote_id: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      install_close_invoices_cron: {
        Args: { _cron_secret: string; _function_url: string }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
      redeem_voucher: { Args: { _code: string }; Returns: Json }
    }
    Enums: {
      app_role: "admin" | "user"
      business_category: "barbearia" | "clinica" | "petshop"
      invoice_item_kind: "base" | "quote_recurring" | "quote_lifetime"
      invoice_status: "open" | "closed" | "paid"
      lead_status: "pendente" | "agendado" | "cancelado"
      notification_type: "system" | "alert"
      profile_status: "pending" | "approved" | "rejected"
      quote_billing_type: "recurring" | "lifetime" | "billing_change"
      quote_status: "pending" | "accepted" | "declined" | "revoked"
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
      business_category: ["barbearia", "clinica", "petshop"],
      invoice_item_kind: ["base", "quote_recurring", "quote_lifetime"],
      invoice_status: ["open", "closed", "paid"],
      lead_status: ["pendente", "agendado", "cancelado"],
      notification_type: ["system", "alert"],
      profile_status: ["pending", "approved", "rejected"],
      quote_billing_type: ["recurring", "lifetime", "billing_change"],
      quote_status: ["pending", "accepted", "declined", "revoked"],
    },
  },
} as const
