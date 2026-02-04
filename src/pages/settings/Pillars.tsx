import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { PILLARS } from '@/lib/constants';
import { ArrowLeft, Edit3, Save, X, GraduationCap, Heart, Shield, Users, TrendingUp, LucideIcon } from 'lucide-react';
import { toast } from 'sonner';

const iconMap: Record<string, LucideIcon> = {
  GraduationCap,
  Heart,
  Shield,
  Users,
  TrendingUp,
};

interface PillarCustomizations {
  displayName: string; // shortName
  categoryName: string; // name
  description: string;
}

interface EditingState {
  pillarId: string;
  field: keyof PillarCustomizations;
}

export default function Pillars() {
  const navigate = useNavigate();
  const [pillarCustomizations, setPillarCustomizations] = useState<Record<string, PillarCustomizations>>({});
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load custom pillar customizations from localStorage
    const saved = localStorage.getItem('customPillarCustomizations');
    if (saved) {
      setPillarCustomizations(JSON.parse(saved));
    } else {
      // Check for old format and migrate
      const oldSaved = localStorage.getItem('customPillarNames');
      if (oldSaved) {
        const oldNames = JSON.parse(oldSaved);
        const migrated: Record<string, PillarCustomizations> = {};
        PILLARS.forEach(pillar => {
          migrated[pillar.id] = {
            displayName: pillar.shortName,
            categoryName: oldNames[pillar.id] || pillar.name,
            description: pillar.description,
          };
        });
        setPillarCustomizations(migrated);
        localStorage.setItem('customPillarCustomizations', JSON.stringify(migrated));
        localStorage.removeItem('customPillarNames'); // Clean up old key
      } else {
        // Initialize with default values
        const defaults: Record<string, PillarCustomizations> = {};
        PILLARS.forEach(pillar => {
          defaults[pillar.id] = {
            displayName: pillar.shortName,
            categoryName: pillar.name,
            description: pillar.description,
          };
        });
        setPillarCustomizations(defaults);
      }
    }
  }, []);

  const handleStartEdit = (pillarId: string, field: keyof PillarCustomizations, currentValue: string) => {
    setEditing({ pillarId, field });
    setTempValue(currentValue);
  };

  const handleSaveEdit = () => {
    if (!editing) return;
    
    setPillarCustomizations(prev => ({
      ...prev,
      [editing.pillarId]: {
        ...prev[editing.pillarId],
        [editing.field]: tempValue
      }
    }));
    
    setEditing(null);
    setTempValue('');
  };

  const handleCancelEdit = () => {
    setEditing(null);
    setTempValue('');
  };

  const handleSave = async () => {
    setSaving(true);

    // Save to localStorage
    localStorage.setItem('customPillarCustomizations', JSON.stringify(pillarCustomizations));

    toast.success('Pillar customizations updated!');
    setSaving(false);
  };

  const truncateText = (text: string, maxLength: number = 60) => {
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <AppLayout>
      <div className="px-4 py-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/settings')}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-display font-bold text-foreground">
              Pillars
            </h1>
          </div>
          <Button
            onClick={handleSave}
            disabled={saving}
            size="sm"
            className="gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save All'}
          </Button>
        </motion.div>

        {/* Description */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <p className="text-muted-foreground text-sm">
            Click the edit icons to customize pillar names and descriptions.
          </p>
        </motion.div>

        {/* Pillars Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
        >
          {PILLARS.map((pillar, index) => {
            const custom = pillarCustomizations[pillar.id] || {
              displayName: pillar.shortName,
              categoryName: pillar.name,
              description: pillar.description,
            };
            
            const isEditingDisplayName = editing?.pillarId === pillar.id && editing?.field === 'displayName';
            const isEditingCategoryName = editing?.pillarId === pillar.id && editing?.field === 'categoryName';
            const isEditingDescription = editing?.pillarId === pillar.id && editing?.field === 'description';

            return (
              <motion.div
                key={pillar.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + index * 0.05 }}
              >
                <Card className="p-3 h-full">
                  <div className="space-y-2">
                    {/* Pillar Header */}
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-lg ${pillar.bgColorClass} flex items-center justify-center flex-shrink-0`}>
                        {(() => {
                          const Icon = iconMap[pillar.icon];
                          return Icon ? <Icon className="w-4 h-4 text-white" /> : null;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        {isEditingDisplayName ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={tempValue}
                              onChange={(e) => setTempValue(e.target.value)}
                              className="text-sm h-8 font-medium"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit();
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                            />
                            <Button size="sm" variant="ghost" onClick={handleSaveEdit} className="h-8 w-8 p-0">
                              <Save className="w-3 h-3" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-8 w-8 p-0">
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <div 
                            className="flex items-center justify-between group cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2"
                            onClick={() => handleStartEdit(pillar.id, 'displayName', custom.displayName)}
                          >
                            <p className="text-sm font-medium">{custom.displayName}</p>
                            <Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Category Name */}
                    <div>
                      {isEditingCategoryName ? (
                        <div className="flex items-center gap-2">
                          <Input
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="text-sm h-8"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit();
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <Button size="sm" variant="ghost" onClick={handleSaveEdit} className="h-8 w-8 p-0">
                            <Save className="w-3 h-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-8 w-8 p-0">
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ) : (
                        <div 
                          className="flex items-center justify-between group cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2"
                          onClick={() => handleStartEdit(pillar.id, 'categoryName', custom.categoryName)}
                        >
                          <span className="text-sm">{custom.categoryName}</span>
                          <Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    <div>
                      {isEditingDescription ? (
                        <div className="space-y-2">
                          <Textarea
                            value={tempValue}
                            onChange={(e) => setTempValue(e.target.value)}
                            className="text-sm min-h-[60px] resize-none"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" onClick={handleSaveEdit} className="h-8 px-2">
                              <Save className="w-3 h-3 mr-1" />
                              Save
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-8 px-2">
                              <X className="w-3 h-3 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          className="group cursor-pointer hover:bg-muted/50 rounded px-2 py-1 -mx-2"
                          onClick={() => handleStartEdit(pillar.id, 'description', custom.description)}
                          title={custom.description}
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs text-muted-foreground leading-relaxed">
                              {truncateText(custom.description, 80)}
                            </span>
                            <Edit3 className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-2 mt-0.5" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </AppLayout>
  );
}