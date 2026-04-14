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
      admin_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      api_cost_logs: {
        Row: {
          campaign_id: string | null
          cost_brl: number
          cost_usd: number
          created_at: string | null
          endpoint: string
          error_message: string | null
          exchange_rate: number | null
          id: string
          input_tokens: number | null
          is_error: boolean | null
          model: string | null
          output_tokens: number | null
          pipeline_step: string | null
          provider: string
          response_time_ms: number | null
          status_code: number | null
          store_id: string | null
        }
        Insert: {
          campaign_id?: string | null
          cost_brl: number
          cost_usd: number
          created_at?: string | null
          endpoint: string
          error_message?: string | null
          exchange_rate?: number | null
          id?: string
          input_tokens?: number | null
          is_error?: boolean | null
          model?: string | null
          output_tokens?: number | null
          pipeline_step?: string | null
          provider: string
          response_time_ms?: number | null
          status_code?: number | null
          store_id?: string | null
        }
        Update: {
          campaign_id?: string | null
          cost_brl?: number
          cost_usd?: number
          created_at?: string | null
          endpoint?: string
          error_message?: string | null
          exchange_rate?: number | null
          id?: string
          input_tokens?: number | null
          is_error?: boolean | null
          model?: string | null
          output_tokens?: number | null
          pipeline_step?: string | null
          provider?: string
          response_time_ms?: number | null
          status_code?: number | null
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_cost_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_cost_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_cost_logs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "v_store_dashboard"
            referencedColumns: ["store_id"]
          },
        ]
      }
      campaign_outputs: {
        Row: {
          campaign_id: string
          created_at: string | null
          creative_feed_url: string | null
          creative_stories_url: string | null
          hashtags: string[] | null
          headline_principal: string | null
          headline_variacao_1: string | null
          headline_variacao_2: string | null
          id: string
          instagram_feed: string | null
          instagram_stories: Json | null
          meta_ads: Json | null
          model_image_url: string | null
          product_image_clean_url: string | null
          refinements: Json | null
          strategy: Json | null
          vision_analysis: Json | null
          vision_cache_hash: string | null
          whatsapp: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string | null
          creative_feed_url?: string | null
          creative_stories_url?: string | null
          hashtags?: string[] | null
          headline_principal?: string | null
          headline_variacao_1?: string | null
          headline_variacao_2?: string | null
          id?: string
          instagram_feed?: string | null
          instagram_stories?: Json | null
          meta_ads?: Json | null
          model_image_url?: string | null
          product_image_clean_url?: string | null
          refinements?: Json | null
          strategy?: Json | null
          vision_analysis?: Json | null
          vision_cache_hash?: string | null
          whatsapp?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string | null
          creative_feed_url?: string | null
          creative_stories_url?: string | null
          hashtags?: string[] | null
          headline_principal?: string | null
          headline_variacao_1?: string | null
          headline_variacao_2?: string | null
          id?: string
          instagram_feed?: string | null
          instagram_stories?: Json | null
          meta_ads?: Json | null
          model_image_url?: string | null
          product_image_clean_url?: string | null
          refinements?: Json | null
          strategy?: Json | null
          vision_analysis?: Json | null
          vision_cache_hash?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campaign_outputs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_scores: {
        Row: {
          alertas_meta: Json | null
          aprovacao_meta: number
          campaign_id: string
          clareza: number
          conversao: number
          created_at: string | null
          id: string
          melhorias: Json | null
          naturalidade: number
          nivel_risco: string
          nota_geral: number
          pontos_fortes: Json | null
          resumo: string | null
          urgencia: number
        }
        Insert: {
          alertas_meta?: Json | null
          aprovacao_meta: number
          campaign_id: string
          clareza: number
          conversao: number
          created_at?: string | null
          id?: string
          melhorias?: Json | null
          naturalidade: number
          nivel_risco: string
          nota_geral: number
          pontos_fortes?: Json | null
          resumo?: string | null
          urgencia: number
        }
        Update: {
          alertas_meta?: Json | null
          aprovacao_meta?: number
          campaign_id?: string
          clareza?: number
          conversao?: number
          created_at?: string | null
          id?: string
          melhorias?: Json | null
          naturalidade?: number
          nivel_risco?: string
          nota_geral?: number
          pontos_fortes?: Json | null
          resumo?: string | null
          urgencia?: number
        }
        Relationships: [
          {
            foreignKeyName: "campaign_scores_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          channels: string[] | null
          created_at: string | null
          error_message: string | null
          generation_number: number | null
          id: string
          is_archived: boolean | null
          model_id: string | null
          objective: string | null
          parent_campaign_id: string | null
          pipeline_completed_at: string | null
          pipeline_duration_ms: number | null
          pipeline_started_at: string | null
          pipeline_step: string | null
          price: number
          product_photo_storage_path: string
          product_photo_url: string
          retry_count: number | null
          status: string | null
          store_id: string
          target_audience: string | null
          tone_override: string | null
          updated_at: string | null
          use_model: boolean | null
        }
        Insert: {
          channels?: string[] | null
          created_at?: string | null
          error_message?: string | null
          generation_number?: number | null
          id?: string
          is_archived?: boolean | null
          model_id?: string | null
          objective?: string | null
          parent_campaign_id?: string | null
          pipeline_completed_at?: string | null
          pipeline_duration_ms?: number | null
          pipeline_started_at?: string | null
          pipeline_step?: string | null
          price: number
          product_photo_storage_path: string
          product_photo_url: string
          retry_count?: number | null
          status?: string | null
          store_id: string
          target_audience?: string | null
          tone_override?: string | null
          updated_at?: string | null
          use_model?: boolean | null
        }
        Update: {
          channels?: string[] | null
          created_at?: string | null
          error_message?: string | null
          generation_number?: number | null
          id?: string
          is_archived?: boolean | null
          model_id?: string | null
          objective?: string | null
          parent_campaign_id?: string | null
          pipeline_completed_at?: string | null
          pipeline_duration_ms?: number | null
          pipeline_started_at?: string | null
          pipeline_step?: string | null
          price?: number
          product_photo_storage_path?: string
          product_photo_url?: string
          retry_count?: number | null
          status?: string | null
          store_id?: string
          target_audience?: string | null
          tone_override?: string | null
          updated_at?: string | null
          use_model?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "store_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_parent_campaign_id_fkey"
            columns: ["parent_campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "v_store_dashboard"
            referencedColumns: ["store_id"]
          },
        ]
      }
      credit_purchases: {
        Row: {
          consumed: number | null
          created_at: string | null
          id: string
          mercadopago_payment_id: string | null
          period_end: string
          period_start: string
          price_brl: number
          quantity: number
          store_id: string
          type: string
        }
        Insert: {
          consumed?: number | null
          created_at?: string | null
          id?: string
          mercadopago_payment_id?: string | null
          period_end: string
          period_start: string
          price_brl: number
          quantity: number
          store_id: string
          type: string
        }
        Update: {
          consumed?: number | null
          created_at?: string | null
          id?: string
          mercadopago_payment_id?: string | null
          period_end?: string
          period_start?: string
          price_brl?: number
          quantity?: number
          store_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_purchases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_purchases_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "v_store_dashboard"
            referencedColumns: ["store_id"]
          },
        ]
      }
      plans: {
        Row: {
          campaigns_per_month: number
          channels_per_campaign: number
          created_at: string | null
          display_name: string
          has_api_access: boolean | null
          has_preview_link: boolean | null
          has_white_label: boolean | null
          history_days: number
          id: string
          is_active: boolean | null
          mercadopago_plan_id: string | null
          model_creations_per_month: number
          models_limit: number
          name: string
          price_monthly: number
          regenerations_per_campaign: number
          score_level: string | null
          sort_order: number | null
          support_channel: string | null
        }
        Insert: {
          campaigns_per_month: number
          channels_per_campaign?: number
          created_at?: string | null
          display_name: string
          has_api_access?: boolean | null
          has_preview_link?: boolean | null
          has_white_label?: boolean | null
          history_days?: number
          id?: string
          is_active?: boolean | null
          mercadopago_plan_id?: string | null
          model_creations_per_month?: number
          models_limit?: number
          name: string
          price_monthly: number
          regenerations_per_campaign?: number
          score_level?: string | null
          sort_order?: number | null
          support_channel?: string | null
        }
        Update: {
          campaigns_per_month?: number
          channels_per_campaign?: number
          created_at?: string | null
          display_name?: string
          has_api_access?: boolean | null
          has_preview_link?: boolean | null
          has_white_label?: boolean | null
          history_days?: number
          id?: string
          is_active?: boolean | null
          mercadopago_plan_id?: string | null
          model_creations_per_month?: number
          models_limit?: number
          name?: string
          price_monthly?: number
          regenerations_per_campaign?: number
          score_level?: string | null
          sort_order?: number | null
          support_channel?: string | null
        }
        Relationships: []
      }
      store_models: {
        Row: {
          age_range: string
          body_type: string | null
          created_at: string | null
          eye_color: string | null
          fashn_model_id: string | null
          hair_style: string
          id: string
          is_active: boolean | null
          name: string | null
          preview_url: string | null
          skin_tone: string
          store_id: string
          style: string
        }
        Insert: {
          age_range: string
          body_type?: string | null
          created_at?: string | null
          eye_color?: string | null
          fashn_model_id?: string | null
          hair_style: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          preview_url?: string | null
          skin_tone: string
          store_id: string
          style: string
        }
        Update: {
          age_range?: string
          body_type?: string | null
          created_at?: string | null
          eye_color?: string | null
          fashn_model_id?: string | null
          hair_style?: string
          id?: string
          is_active?: boolean | null
          name?: string | null
          preview_url?: string | null
          skin_tone?: string
          store_id?: string
          style?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_models_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_models_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "v_store_dashboard"
            referencedColumns: ["store_id"]
          },
        ]
      }
      store_usage: {
        Row: {
          campaigns_generated: number | null
          campaigns_limit: number
          created_at: string | null
          id: string
          models_created: number | null
          period_end: string
          period_start: string
          regenerations_used: number | null
          store_id: string
          total_api_cost: number | null
        }
        Insert: {
          campaigns_generated?: number | null
          campaigns_limit: number
          created_at?: string | null
          id?: string
          models_created?: number | null
          period_end: string
          period_start: string
          regenerations_used?: number | null
          store_id: string
          total_api_cost?: number | null
        }
        Update: {
          campaigns_generated?: number | null
          campaigns_limit?: number
          created_at?: string | null
          id?: string
          models_created?: number | null
          period_end?: string
          period_start?: string
          regenerations_used?: number | null
          store_id?: string
          total_api_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "store_usage_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_usage_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "v_store_dashboard"
            referencedColumns: ["store_id"]
          },
        ]
      }
      stores: {
        Row: {
          backdrop_color: string | null
          backdrop_ref_url: string | null
          backdrop_updated_at: string | null
          brand_colors: Json | null
          city: string | null
          clerk_user_id: string
          created_at: string | null
          id: string
          instagram_handle: string | null
          logo_url: string | null
          mercadopago_customer_id: string | null
          mercadopago_subscription_id: string | null
          name: string
          onboarding_completed: boolean | null
          plan_id: string | null
          segment_primary: string
          segments_secondary: string[] | null
          state: string | null
          updated_at: string | null
        }
        Insert: {
          backdrop_color?: string | null
          backdrop_ref_url?: string | null
          backdrop_updated_at?: string | null
          brand_colors?: Json | null
          city?: string | null
          clerk_user_id: string
          created_at?: string | null
          id?: string
          instagram_handle?: string | null
          logo_url?: string | null
          mercadopago_customer_id?: string | null
          mercadopago_subscription_id?: string | null
          name: string
          onboarding_completed?: boolean | null
          plan_id?: string | null
          segment_primary: string
          segments_secondary?: string[] | null
          state?: string | null
          updated_at?: string | null
        }
        Update: {
          backdrop_color?: string | null
          backdrop_ref_url?: string | null
          backdrop_updated_at?: string | null
          brand_colors?: Json | null
          city?: string | null
          clerk_user_id?: string
          created_at?: string | null
          id?: string
          instagram_handle?: string | null
          logo_url?: string | null
          mercadopago_customer_id?: string | null
          mercadopago_subscription_id?: string | null
          name?: string
          onboarding_completed?: boolean | null
          plan_id?: string | null
          segment_primary?: string
          segments_secondary?: string[] | null
          state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stores_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_admin_metrics: {
        Row: {
          active_stores: number | null
          api_cost_this_month_brl: number | null
          api_cost_this_month_usd: number | null
          campaigns_this_month: number | null
          completed_this_month: number | null
          failed_this_month: number | null
          total_stores: number | null
        }
        Relationships: []
      }
      v_store_dashboard: {
        Row: {
          campaigns_limit: number | null
          campaigns_remaining: number | null
          campaigns_used: number | null
          models_created: number | null
          models_limit: number | null
          onboarding_completed: boolean | null
          plan_name: string | null
          price_monthly: number | null
          regenerations_limit: number | null
          regenerations_used: number | null
          store_id: string | null
          store_name: string | null
          total_campaigns_completed: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      can_generate_campaign: { Args: { p_store_id: string }; Returns: boolean }
      increment_campaign_usage: {
        Args: { p_store_id: string }
        Returns: undefined
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

