import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Plus, Trash2, LogOut, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProfile, Profile } from '@/contexts/ProfileContext';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function ProfilePicker() {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { profiles, setCurrentProfile, deleteProfile, loading } = useProfile();
  const [profileToDelete, setProfileToDelete] = useState<Profile | null>(null);

  const handleSelectProfile = (profile: Profile) => {
    setCurrentProfile(profile);
    navigate('/app');
  };

  const handleDeleteProfile = async () => {
    if (profileToDelete) {
      await deleteProfile(profileToDelete.id);
      setProfileToDelete(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-screen px-6 py-12"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Choose Profile</h1>
          <p className="text-sm text-muted-foreground">Select or create a profile</p>
        </div>
        <Button
          onClick={handleSignOut}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </div>

      {/* Profiles Grid */}
      <div className="space-y-4 mb-8">
        <AnimatePresence>
          {profiles.map((profile, index) => (
            <motion.div
              key={profile.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="glass-card p-4 flex items-center justify-between group">
                <button
                  onClick={() => handleSelectProfile(profile)}
                  className="flex items-center gap-4 flex-1 text-left"
                >
                  <div className="p-3 rounded-xl bg-primary/20">
                    <User className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{profile.username}</h3>
                    <p className="text-sm text-muted-foreground">
                      Goal: {profile.daily_goal} {profile.unit_preference} • {profile.activity_level}
                    </p>
                  </div>
                </button>
                <Button
                  onClick={(e) => {
                    e.stopPropagation();
                    setProfileToDelete(profile);
                  }}
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete profile ${profile.username}`}
                  className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {profiles.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <User className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <h3 className="text-lg font-medium text-muted-foreground mb-2">No profiles yet</h3>
            <p className="text-sm text-muted-foreground">Create your first profile to get started</p>
          </motion.div>
        )}
      </div>

      {/* Create New Profile Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Button
          onClick={() => navigate('/profile/create')}
          className="w-full py-6 bg-primary hover:bg-primary/90"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create New Profile
        </Button>
      </motion.div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!profileToDelete} onOpenChange={() => setProfileToDelete(null)}>
        <AlertDialogContent className="glass-card border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete Profile?</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              This will permanently delete "{profileToDelete?.username}" and all associated water logs.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteProfile} className="bg-destructive hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}