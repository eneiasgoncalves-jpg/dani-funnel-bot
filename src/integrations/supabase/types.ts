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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      clientes: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cpf: string | null
          created_at: string
          data_evento: string | null
          data_nascimento: string | null
          email: string | null
          endereco_completo: string | null
          id: string
          lead_id: string | null
          nome: string
          observacoes: string | null
          telefone: string
          updated_at: string
          valor_contrato: number | null
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          data_evento?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco_completo?: string | null
          id?: string
          lead_id?: string | null
          nome: string
          observacoes?: string | null
          telefone: string
          updated_at?: string
          valor_contrato?: number | null
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cpf?: string | null
          created_at?: string
          data_evento?: string | null
          data_nascimento?: string | null
          email?: string | null
          endereco_completo?: string | null
          id?: string
          lead_id?: string | null
          nome?: string
          observacoes?: string | null
          telefone?: string
          updated_at?: string
          valor_contrato?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clientes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_enabled: boolean
          archived: boolean
          channel: Database["public"]["Enums"]["sales_channel"]
          children_age: string | null
          children_count: number | null
          city: string | null
          created_at: string
          event_date: string | null
          feedback_sent: boolean
          id: string
          interest: string | null
          name: string
          neighborhood: string | null
          phone: string
          read_until: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tags: Database["public"]["Enums"]["lead_tag"][] | null
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          archived?: boolean
          channel?: Database["public"]["Enums"]["sales_channel"]
          children_age?: string | null
          children_count?: number | null
          city?: string | null
          created_at?: string
          event_date?: string | null
          feedback_sent?: boolean
          id?: string
          interest?: string | null
          name?: string
          neighborhood?: string | null
          phone: string
          read_until?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: Database["public"]["Enums"]["lead_tag"][] | null
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          archived?: boolean
          channel?: Database["public"]["Enums"]["sales_channel"]
          children_age?: string | null
          children_count?: number | null
          city?: string | null
          created_at?: string
          event_date?: string | null
          feedback_sent?: boolean
          id?: string
          interest?: string | null
          name?: string
          neighborhood?: string | null
          phone?: string
          read_until?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: Database["public"]["Enums"]["lead_tag"][] | null
          updated_at?: string
        }
        Relationships: []
      }
      leads_analytics: {
        Row: {
          cidade: string | null
          cliente_whatsapp: string
          data_entrada: string
          data_fechamento: string | null
          id: string
          plataforma: string
          status: string
          valor_contrato: number | null
        }
        Insert: {
          cidade?: string | null
          cliente_whatsapp: string
          data_entrada?: string
          data_fechamento?: string | null
          id?: string
          plataforma?: string
          status?: string
          valor_contrato?: number | null
        }
        Update: {
          cidade?: string | null
          cliente_whatsapp?: string
          data_entrada?: string
          data_fechamento?: string | null
          id?: string
          plataforma?: string
          status?: string
          valor_contrato?: number | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          sender: string
          text: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          sender: string
          text: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          sender?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      lead_status:
        | "novo"
        | "analise"
        | "proposta"
        | "contra_proposta"
        | "fechado"
        | "perdido"
      lead_tag: "quente" | "duvida" | "sensivel_preco" | "frio"
      sales_channel: "whatsapp" | "instagram" | "google" | "site" | "indicacao"
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
      lead_status: [
        "novo",
        "analise",
        "proposta",
        "contra_proposta",
        "fechado",
        "perdido",
      ],
      lead_tag: ["quente", "duvida", "sensivel_preco", "frio"],
      sales_channel: ["whatsapp", "instagram", "google", "site", "indicacao"],
    },
  },
} as const
