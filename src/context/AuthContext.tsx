import React, { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext } from './auth-context'

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 1. Initial session fetch
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // 2. Auth state observer
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) {
        return { error: error.message }
      }
      return { error: null }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      return { error: message }
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('Error during signOut:', err)
    }
  }

  return (
    <AuthContext.Provider value={{ session, user, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}
