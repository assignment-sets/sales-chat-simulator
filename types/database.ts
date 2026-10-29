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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      chats: {
        Row: {
          ai_feedback: string | null
          created_at: string
          evaluation_outcome: string | null
          evaluation_summary: Json | null
          id: string
          organization_id: string
          product_description: string
          product_name: string
          score: number | null
          status: string
          tokens_used: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_feedback?: string | null
          created_at?: string
          evaluation_outcome?: string | null
          evaluation_summary?: Json | null
          id?: string
          organization_id: string
          product_description: string
          product_name: string
          score?: number | null
          status?: string
          tokens_used?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_feedback?: string | null
          created_at?: string
          evaluation_outcome?: string | null
          evaluation_summary?: Json | null
          id?: string
          organization_id?: string
          product_description?: string
          product_name?: string
          score?: number | null
          status?: string
          tokens_used?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string
          completion_tokens: number | null
          content: string
          created_at: string
          id: string
          prompt_tokens: number | null
          role: string
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          chat_id: string
          completion_tokens?: number | null
          content: string
          created_at?: string
          id?: string
          prompt_tokens?: number | null
          role: string
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          chat_id?: string
          completion_tokens?: number | null
          content?: string
          created_at?: string
          id?: string
          prompt_tokens?: number | null
          role?: string
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          organization_id: string
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          plan_tier: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          plan_tier?: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          plan_tier?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      organization_ai_usage: {
        Row: {
          completion_tokens: number
          estimated_cost_usd: number
          organization_id: string
          period_start: string
          prompt_tokens: number
          total_tokens: number
          updated_at: string
        }
        Insert: {
          completion_tokens?: number
          estimated_cost_usd?: number
          organization_id: string
          period_start: string
          prompt_tokens?: number
          total_tokens?: number
          updated_at?: string
        }
        Update: {
          completion_tokens?: number
          estimated_cost_usd?: number
          organization_id?: string
          period_start?: string
          prompt_tokens?: number
          total_tokens?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_ai_usage_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_pending_org_invitations: {
        Args: { user_email: string; user_id: string }
        Returns: undefined
      }
      create_chat_with_quota: {
        Args: {
          target_org_id: string
          target_product_description: string
          target_product_name: string
        }
        Returns: Json
      }
      create_organization_with_owner: {
        Args: { org_name: string; org_slug: string }
        Returns: Json
      }
      get_organization_members: {
        Args: { target_org_id: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }[]
      }
      invite_or_add_org_member: {
        Args: {
          target_email: string
          target_org_id: string
          target_role?: string
        }
        Returns: Json
      }
      update_organization_plan_tier: {
        Args: { new_tier: string; target_org_id: string }
        Returns: Json
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;

// Convenient domain aliases
export type DbChat = Tables<"chats">;
export type DbChatInsert = TablesInsert<"chats">;
export type DbChatUpdate = TablesUpdate<"chats">;

export type DbMessage = Tables<"messages">;
export type DbMessageInsert = TablesInsert<"messages">;
export type DbMessageUpdate = TablesUpdate<"messages">;

export type DbOrganization = Tables<"organizations">;
export type DbOrganizationInsert = TablesInsert<"organizations">;
export type DbOrganizationUpdate = TablesUpdate<"organizations">;

export type DbOrganizationMember = Tables<"organization_members">;
export type DbOrganizationMemberInsert = TablesInsert<"organization_members">;
export type DbOrganizationMemberUpdate = TablesUpdate<"organization_members">;

export type DbOrganizationInvitation = Tables<"organization_invitations">;
export type DbOrganizationInvitationInsert = TablesInsert<"organization_invitations">;
export type DbOrganizationInvitationUpdate = TablesUpdate<"organization_invitations">;

export type DbOrganizationAiUsage = Tables<"organization_ai_usage">;
export type DbOrganizationAiUsageInsert = TablesInsert<"organization_ai_usage">;
export type DbOrganizationAiUsageUpdate = TablesUpdate<"organization_ai_usage">;

