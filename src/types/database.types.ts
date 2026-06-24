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
      announcement_reads: {
        Row: {
          announcement_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          announcement_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          announcement_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_reads_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          category: Database["public"]["Enums"]["announcement_category"]
          content: string
          created_at: string
          expires_at: string | null
          hostel_id: string
          id: string
          is_pinned: boolean
          posted_by: string
          title: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["announcement_category"]
          content: string
          created_at?: string
          expires_at?: string | null
          hostel_id: string
          id?: string
          is_pinned?: boolean
          posted_by: string
          title: string
        }
        Update: {
          category?: Database["public"]["Enums"]["announcement_category"]
          content?: string
          created_at?: string
          expires_at?: string | null
          hostel_id?: string
          id?: string
          is_pinned?: boolean
          posted_by?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcements_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcements_posted_by_fkey"
            columns: ["posted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      complaint_updates: {
        Row: {
          complaint_id: string
          created_at: string
          id: string
          new_status: Database["public"]["Enums"]["complaint_status"]
          note: string | null
          old_status: Database["public"]["Enums"]["complaint_status"] | null
          updated_by: string
        }
        Insert: {
          complaint_id: string
          created_at?: string
          id?: string
          new_status: Database["public"]["Enums"]["complaint_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["complaint_status"] | null
          updated_by: string
        }
        Update: {
          complaint_id?: string
          created_at?: string
          id?: string
          new_status?: Database["public"]["Enums"]["complaint_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["complaint_status"] | null
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaint_updates_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaint_updates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          assigned_to: string | null
          category: Database["public"]["Enums"]["complaint_category"]
          created_at: string
          description: string
          hostel_id: string
          id: string
          photos: string[]
          priority: Database["public"]["Enums"]["complaint_priority"]
          rating: number | null
          resolution_note: string | null
          resolved_at: string | null
          status: Database["public"]["Enums"]["complaint_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          category: Database["public"]["Enums"]["complaint_category"]
          created_at?: string
          description: string
          hostel_id: string
          id?: string
          photos?: string[]
          priority?: Database["public"]["Enums"]["complaint_priority"]
          rating?: number | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          category?: Database["public"]["Enums"]["complaint_category"]
          created_at?: string
          description?: string
          hostel_id?: string
          id?: string
          photos?: string[]
          priority?: Database["public"]["Enums"]["complaint_priority"]
          rating?: number | null
          resolution_note?: string | null
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["complaint_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expense_splits: {
        Row: {
          amount: number
          expense_id: string
          id: string
          is_paid: boolean
          note: string | null
          paid_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          expense_id: string
          id?: string
          is_paid?: boolean
          note?: string | null
          paid_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          expense_id?: string
          id?: string
          is_paid?: boolean
          note?: string | null
          paid_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          created_by: string
          date: string
          description: string | null
          hostel_id: string
          id: string
          is_settled: boolean
          paid_by: string
          title: string
          total_amount: number
        }
        Insert: {
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by: string
          date?: string
          description?: string | null
          hostel_id: string
          id?: string
          is_settled?: boolean
          paid_by: string
          title: string
          total_amount: number
        }
        Update: {
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          created_by?: string
          date?: string
          description?: string | null
          hostel_id?: string
          id?: string
          is_settled?: boolean
          paid_by?: string
          title?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_passes: {
        Row: {
          expires_at: string
          generated_at: string
          hostel_id: string
          id: string
          pass_type: Database["public"]["Enums"]["pass_type"]
          qr_token: string
          scanned_at: string | null
          scanned_by: string | null
          status: Database["public"]["Enums"]["pass_status"]
          user_id: string
        }
        Insert: {
          expires_at: string
          generated_at?: string
          hostel_id: string
          id?: string
          pass_type: Database["public"]["Enums"]["pass_type"]
          qr_token: string
          scanned_at?: string | null
          scanned_by?: string | null
          status?: Database["public"]["Enums"]["pass_status"]
          user_id: string
        }
        Update: {
          expires_at?: string
          generated_at?: string
          hostel_id?: string
          id?: string
          pass_type?: Database["public"]["Enums"]["pass_type"]
          qr_token?: string
          scanned_at?: string | null
          scanned_by?: string | null
          status?: Database["public"]["Enums"]["pass_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gate_passes_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_passes_scanned_by_fkey"
            columns: ["scanned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_passes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gate_trips: {
        Row: {
          created_at: string
          destination: string
          exit_approved_by: string | null
          exit_at: string | null
          expected_return_at: string
          guard_notes: string | null
          hostel_id: string
          id: string
          linked_leave_id: string | null
          purpose: string | null
          return_at: string | null
          return_logged_by: string | null
          status: Database["public"]["Enums"]["trip_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination: string
          exit_approved_by?: string | null
          exit_at?: string | null
          expected_return_at: string
          guard_notes?: string | null
          hostel_id: string
          id?: string
          linked_leave_id?: string | null
          purpose?: string | null
          return_at?: string | null
          return_logged_by?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          destination?: string
          exit_approved_by?: string | null
          exit_at?: string | null
          expected_return_at?: string
          guard_notes?: string | null
          hostel_id?: string
          id?: string
          linked_leave_id?: string | null
          purpose?: string | null
          return_at?: string | null
          return_logged_by?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gate_trips_exit_approved_by_fkey"
            columns: ["exit_approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_trips_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_trips_linked_leave_id_fkey"
            columns: ["linked_leave_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_trips_return_logged_by_fkey"
            columns: ["return_logged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gate_trips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hostels: {
        Row: {
          address: string | null
          city: string | null
          contact_phone: string | null
          created_at: string
          curfew_time: string | null
          hostel_code: string
          id: string
          name: string
          property_type: Database["public"]["Enums"]["property_type"]
          state: string | null
          subscription: string
          total_rooms: number | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          curfew_time?: string | null
          hostel_code?: string
          id?: string
          name: string
          property_type?: Database["public"]["Enums"]["property_type"]
          state?: string | null
          subscription?: string
          total_rooms?: number | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_phone?: string | null
          created_at?: string
          curfew_time?: string | null
          hostel_code?: string
          id?: string
          name?: string
          property_type?: Database["public"]["Enums"]["property_type"]
          state?: string | null
          subscription?: string
          total_rooms?: number | null
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          created_at: string
          destination: string | null
          from_date: string
          hostel_id: string
          id: string
          reason: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["leave_status"]
          to_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination?: string | null
          from_date: string
          hostel_id: string
          id?: string
          reason: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["leave_status"]
          to_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          destination?: string | null
          from_date?: string
          hostel_id?: string
          id?: string
          reason?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["leave_status"]
          to_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lost_found: {
        Row: {
          created_at: string
          date_occurred: string | null
          description: string | null
          hostel_id: string
          id: string
          images: string[]
          item_name: string
          location: string | null
          status: string
          type: Database["public"]["Enums"]["lostfound_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          date_occurred?: string | null
          description?: string | null
          hostel_id: string
          id?: string
          images?: string[]
          item_name: string
          location?: string | null
          status?: string
          type: Database["public"]["Enums"]["lostfound_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          date_occurred?: string | null
          description?: string | null
          hostel_id?: string
          id?: string
          images?: string[]
          item_name?: string
          location?: string | null
          status?: string
          type?: Database["public"]["Enums"]["lostfound_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lost_found_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lost_found_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_listings: {
        Row: {
          category: string
          condition: Database["public"]["Enums"]["listing_condition"]
          created_at: string
          description: string | null
          hostel_id: string
          id: string
          images: string[]
          price: number | null
          status: Database["public"]["Enums"]["listing_status"]
          title: string
          user_id: string
        }
        Insert: {
          category?: string
          condition?: Database["public"]["Enums"]["listing_condition"]
          created_at?: string
          description?: string | null
          hostel_id: string
          id?: string
          images?: string[]
          price?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          title: string
          user_id: string
        }
        Update: {
          category?: string
          condition?: Database["public"]["Enums"]["listing_condition"]
          created_at?: string
          description?: string | null
          hostel_id?: string
          id?: string
          images?: string[]
          price?: number | null
          status?: Database["public"]["Enums"]["listing_status"]
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_listings_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "marketplace_listings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mess_feedback: {
        Row: {
          comment: string | null
          created_at: string
          date: string
          hostel_id: string
          id: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          rating: number
          user_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          date: string
          hostel_id: string
          id?: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          rating: number
          user_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          date?: string
          hostel_id?: string
          id?: string
          meal_type?: Database["public"]["Enums"]["meal_type"]
          rating?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mess_feedback_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mess_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mess_menu: {
        Row: {
          created_by: string | null
          date: string
          hostel_id: string
          id: string
          items: string[]
          meal_type: Database["public"]["Enums"]["meal_type"]
        }
        Insert: {
          created_by?: string | null
          date: string
          hostel_id: string
          id?: string
          items?: string[]
          meal_type: Database["public"]["Enums"]["meal_type"]
        }
        Update: {
          created_by?: string | null
          date?: string
          hostel_id?: string
          id?: string
          items?: string[]
          meal_type?: Database["public"]["Enums"]["meal_type"]
        }
        Relationships: [
          {
            foreignKeyName: "mess_menu_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mess_menu_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
        ]
      }
      mess_optouts: {
        Row: {
          breakfast: boolean
          date: string
          dinner: boolean
          hostel_id: string
          id: string
          lunch: boolean
          user_id: string
        }
        Insert: {
          breakfast?: boolean
          date: string
          dinner?: boolean
          hostel_id: string
          id?: string
          lunch?: boolean
          user_id: string
        }
        Update: {
          breakfast?: boolean
          date?: string
          dinner?: boolean
          hostel_id?: string
          id?: string
          lunch?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mess_optouts_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mess_optouts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mess_rates: {
        Row: {
          breakfast_rate: number
          dinner_rate: number
          effective_from: string
          effective_to: string | null
          hostel_id: string
          id: string
          lunch_rate: number
        }
        Insert: {
          breakfast_rate?: number
          dinner_rate?: number
          effective_from: string
          effective_to?: string | null
          hostel_id: string
          id?: string
          lunch_rate?: number
        }
        Update: {
          breakfast_rate?: number
          dinner_rate?: number
          effective_from?: string
          effective_to?: string | null
          hostel_id?: string
          id?: string
          lunch_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "mess_rates_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
        ]
      }
      mess_settings: {
        Row: {
          cutoff_time: string   // "HH:MM:SS" e.g. "07:30:00"
          enabled: boolean
          end_time: string      // "HH:MM:SS"
          hostel_id: string
          id: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          start_time: string    // "HH:MM:SS"
        }
        Insert: {
          cutoff_time: string
          enabled?: boolean
          end_time: string
          hostel_id: string
          id?: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          start_time: string
        }
        Update: {
          cutoff_time?: string
          enabled?: boolean
          end_time?: string
          hostel_id?: string
          id?: string
          meal_type?: Database["public"]["Enums"]["meal_type"]
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "mess_settings_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json | null
          id: string
          is_read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          is_read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_consents: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          parent_email: string
          parent_name: string
          parent_phone: string | null
          student_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          parent_email: string
          parent_name: string
          parent_phone?: string | null
          student_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          parent_email?: string
          parent_name?: string
          parent_phone?: string | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_consents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          due_date: string | null
          hostel_id: string
          id: string
          paid_date: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          reference_id: string | null
          status: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          hostel_id: string
          id?: string
          paid_date?: string | null
          payment_type: Database["public"]["Enums"]["payment_type"]
          reference_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          hostel_id?: string
          id?: string
          paid_date?: string | null
          payment_type?: Database["public"]["Enums"]["payment_type"]
          reference_id?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          aadhaar_number: string | null
          allergies: string | null
          avatar_url: string | null
          blood_group: string | null
          college_name: string | null
          college_year: string | null
          course: string | null
          created_at: string
          date_of_birth: string | null
          full_name: string
          hometown: string | null
          hostel_id: string | null
          id: string
          is_active: boolean
          medical_conditions: string | null
          parent_name: string | null
          parent_phone: string | null
          phone: string | null
          profile_completed: boolean
          qr_identity_token: string
          role: Database["public"]["Enums"]["user_role"]
          room_number: string | null
          student_id: string | null
          updated_at: string
        }
        Insert: {
          aadhaar_number?: string | null
          allergies?: string | null
          avatar_url?: string | null
          blood_group?: string | null
          college_name?: string | null
          college_year?: string | null
          course?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name: string
          hometown?: string | null
          hostel_id?: string | null
          id: string
          is_active?: boolean
          medical_conditions?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string | null
          profile_completed?: boolean
          qr_identity_token?: string
          role?: Database["public"]["Enums"]["user_role"]
          room_number?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          aadhaar_number?: string | null
          allergies?: string | null
          avatar_url?: string | null
          blood_group?: string | null
          college_name?: string | null
          college_year?: string | null
          course?: string | null
          created_at?: string
          date_of_birth?: string | null
          full_name?: string
          hometown?: string | null
          hostel_id?: string | null
          id?: string
          is_active?: boolean
          medical_conditions?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          phone?: string | null
          profile_completed?: boolean
          qr_identity_token?: string
          role?: Database["public"]["Enums"]["user_role"]
          room_number?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_assignments: {
        Row: {
          assigned_at: string
          id: string
          is_current: boolean
          room_id: string
          user_id: string
          vacated_at: string | null
        }
        Insert: {
          assigned_at?: string
          id?: string
          is_current?: boolean
          room_id: string
          user_id: string
          vacated_at?: string | null
        }
        Update: {
          assigned_at?: string
          id?: string
          is_current?: boolean
          room_id?: string
          user_id?: string
          vacated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_assignments_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          amenities: string[]
          capacity: number
          floor: number | null
          hostel_id: string
          id: string
          is_occupied: boolean
          room_number: string
          type: Database["public"]["Enums"]["room_type"]
        }
        Insert: {
          amenities?: string[]
          capacity?: number
          floor?: number | null
          hostel_id: string
          id?: string
          is_occupied?: boolean
          room_number: string
          type?: Database["public"]["Enums"]["room_type"]
        }
        Update: {
          amenities?: string[]
          capacity?: number
          floor?: number | null
          hostel_id?: string
          id?: string
          is_occupied?: boolean
          room_number?: string
          type?: Database["public"]["Enums"]["room_type"]
        }
        Relationships: [
          {
            foreignKeyName: "rooms_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
        ]
      }
      sos_incidents: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string
          hostel_id: string
          id: string
          location_desc: string | null
          location_lat: number | null
          location_lng: number | null
          status: Database["public"]["Enums"]["sos_status"]
          user_id: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          hostel_id: string
          id?: string
          location_desc?: string | null
          location_lat?: number | null
          location_lng?: number | null
          status?: Database["public"]["Enums"]["sos_status"]
          user_id: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string
          hostel_id?: string
          id?: string
          location_desc?: string | null
          location_lat?: number | null
          location_lng?: number | null
          status?: Database["public"]["Enums"]["sos_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sos_incidents_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sos_incidents_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sos_incidents_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      visitors: {
        Row: {
          created_at: string
          expected_date: string
          expected_time: string | null
          host_user_id: string
          hostel_id: string
          id: string
          pass_expiry: string | null
          purpose: string | null
          status: Database["public"]["Enums"]["visitor_status"]
          visitor_name: string
          visitor_phone: string
        }
        Insert: {
          created_at?: string
          expected_date: string
          expected_time?: string | null
          host_user_id: string
          hostel_id: string
          id?: string
          pass_expiry?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          visitor_name: string
          visitor_phone: string
        }
        Update: {
          created_at?: string
          expected_date?: string
          expected_time?: string | null
          host_user_id?: string
          hostel_id?: string
          id?: string
          pass_expiry?: string | null
          purpose?: string | null
          status?: Database["public"]["Enums"]["visitor_status"]
          visitor_name?: string
          visitor_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "visitors_host_user_id_fkey"
            columns: ["host_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visitors_hostel_id_fkey"
            columns: ["hostel_id"]
            isOneToOne: false
            referencedRelation: "hostels"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_room: {
        Args: { p_user_id: string; p_room_number: string }
        Returns: undefined
      }
      approve_join_request: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      create_hostel_for_user: {
        Args: {
          p_city?: string
          p_contact_phone?: string
          p_name: string
          p_property_type?: Database["public"]["Enums"]["property_type"]
          p_state?: string
          p_total_rooms?: number
        }
        Returns: Json
      }
      expire_gate_passes: { Args: never; Returns: undefined }
      expire_visitors: { Args: never; Returns: undefined }
      generate_hostel_code: { Args: never; Returns: string }
      get_my_hostel_id: { Args: never; Returns: string }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_pending_members: {
        Args: { p_hostel_id: string }
        Returns: { id: string; full_name: string; phone: string | null; created_at: string }[]
      }
      guard_create_trip: {
        Args: {
          p_user_id: string
          p_destination: string
          p_expected_return_at: string
          p_purpose?: string
        }
        Returns: string
      }
      is_staff: { Args: never; Returns: boolean }
      join_hostel_by_code: { Args: { p_code: string }; Returns: Json }
      mark_overdue_trips: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reject_join_request: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      update_overdue_payments: { Args: never; Returns: undefined }
      use_trip_exit: {
        Args: { p_qr_token: string; p_guard_notes?: string }
        Returns: {
          trip_id: string
          student_name: string
          room_number: string | null
          destination: string
          purpose: string | null
          expected_return_at: string
          exit_at: string
          linked_leave_id: string | null
          duration_minutes: number | null
        }
      }
      use_trip_return: {
        Args: { p_qr_token: string; p_guard_notes?: string }
        Returns: {
          trip_id: string
          student_name: string
          room_number: string | null
          destination: string
          purpose: string | null
          expected_return_at: string
          exit_at: string
          linked_leave_id: string | null
          duration_minutes: number
        }
      }
    }
    Enums: {
      announcement_category:
        | "general"
        | "event"
        | "rule"
        | "emergency"
        | "maintenance"
      complaint_category:
        | "electrical"
        | "plumbing"
        | "wifi"
        | "cleaning"
        | "furniture"
        | "other"
      complaint_priority: "low" | "medium" | "high" | "urgent"
      complaint_status:
        | "submitted"
        | "in_progress"
        | "resolved"
        | "closed"
        | "rejected"
      expense_category:
        | "rent"
        | "electricity"
        | "water"
        | "internet"
        | "groceries"
        | "household"
        | "food"
        | "transport"
        | "other"
      leave_status: "pending" | "approved" | "rejected" | "cancelled"
      listing_condition: "new" | "like_new" | "good" | "fair" | "poor"
      listing_status: "active" | "sold" | "removed"
      lostfound_type: "lost" | "found"
      meal_type: "breakfast" | "lunch" | "dinner"
      pass_status: "active" | "used" | "expired"
      pass_type: "entry" | "exit"
      payment_status: "pending" | "paid" | "overdue"
      payment_type: "rent" | "mess" | "electricity" | "maintenance" | "other"
      property_type: "hostel" | "pg" | "shared"
      room_type: "single" | "double" | "triple" | "dormitory"
      sos_status: "active" | "responded" | "resolved"
      trip_status: "cancelled" | "out" | "overdue" | "pending" | "returned"
      user_role: "student" | "warden" | "manager" | "security" | "parent"
      visitor_status: "pending" | "approved" | "arrived" | "left" | "expired"
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
      announcement_category: [
        "general",
        "event",
        "rule",
        "emergency",
        "maintenance",
      ],
      complaint_category: [
        "electrical",
        "plumbing",
        "wifi",
        "cleaning",
        "furniture",
        "other",
      ],
      complaint_priority: ["low", "medium", "high", "urgent"],
      complaint_status: [
        "submitted",
        "in_progress",
        "resolved",
        "closed",
        "rejected",
      ],
      expense_category: [
        "rent",
        "electricity",
        "water",
        "internet",
        "groceries",
        "household",
        "food",
        "transport",
        "other",
      ],
      leave_status: ["pending", "approved", "rejected", "cancelled"],
      listing_condition: ["new", "like_new", "good", "fair", "poor"],
      listing_status: ["active", "sold", "removed"],
      lostfound_type: ["lost", "found"],
      meal_type: ["breakfast", "lunch", "dinner"],
      pass_status: ["active", "used", "expired"],
      pass_type: ["entry", "exit"],
      payment_status: ["pending", "paid", "overdue"],
      payment_type: ["rent", "mess", "electricity", "maintenance", "other"],
      property_type: ["hostel", "pg", "shared"],
      room_type: ["single", "double", "triple", "dormitory"],
      sos_status: ["active", "responded", "resolved"],
      trip_status: ["cancelled", "out", "overdue", "pending", "returned"],
      user_role: ["student", "warden", "manager", "security", "parent"],
      visitor_status: ["pending", "approved", "arrived", "left", "expired"],
    },
  },
} as const
