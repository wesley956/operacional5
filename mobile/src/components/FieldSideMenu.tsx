import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

interface FieldSideMenuProps {
  visible: boolean;
  onClose: () => void;
}

interface MenuItem {
  icon: string;
  label: string;
  description: string;
  action: () => void;
  danger?: boolean;
}

export function FieldSideMenu({ visible, onClose }: FieldSideMenuProps) {
  const [collapsed, setCollapsed] = useState(false);

  function go(path: string) {
    onClose();
    router.push(path as never);
  }

  const items: MenuItem[] = [
    {
      icon: '📅',
      label: 'Escala de hoje',
      description: 'Voltar para a tela inicial e ver o posto/turno atual.',
      action: onClose,
    },
    {
      icon: '✅',
      label: 'Check-in',
      description: 'Confirmar presença com GPS e evidência.',
      action: () => go('/check-in'),
    },
    {
      icon: '🚨',
      label: 'SOS',
      description: 'Acionar alerta crítico rapidamente.',
      action: () => go('/sos'),
      danger: true,
    },
    {
      icon: '📝',
      label: 'Ocorrência',
      description: 'Registrar ocorrência com foto e localização.',
      action: () => go('/occurrence'),
    },
    {
      icon: '📍',
      label: 'Ronda / QR',
      description: 'Confirmar ponto de ronda por QR Code.',
      action: () => go('/ronda'),
    },
    {
      icon: '🔁',
      label: 'Passagem',
      description: 'Registrar passagem de plantão.',
      action: () => go('/handover'),
    },
    {
      icon: '🕘',
      label: 'Histórico',
      description: 'Ver eventos enviados, pendentes e sincronizados.',
      action: () => go('/history'),
    },
    {
      icon: '👤',
      label: 'Perfil',
      description: 'Dados do usuário, notificações e sair.',
      action: () => go('/profile'),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={[styles.panel, collapsed && styles.panelCollapsed]}>
          <View style={styles.header}>
            <View style={styles.brandIcon}>
              <Text style={styles.brandIconText}>O5</Text>
            </View>

            {!collapsed ? (
              <View style={styles.brandText}>
                <Text style={styles.title}>Operação</Text>
                <Text style={styles.subtitle}>Menu de campo</Text>
              </View>
            ) : null}
          </View>

          <Pressable style={styles.collapseButton} onPress={() => setCollapsed((value) => !value)}>
            <Text style={styles.collapseText}>{collapsed ? '»' : '« Recolher'}</Text>
          </Pressable>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {items.map((item) => (
              <Pressable
                key={item.label}
                style={[styles.item, item.danger && styles.itemDanger]}
                onPress={item.action}
              >
                <Text style={styles.itemIcon}>{item.icon}</Text>

                {!collapsed ? (
                  <View style={styles.itemTextWrap}>
                    <Text style={[styles.itemLabel, item.danger && styles.itemDangerLabel]}>{item.label}</Text>
                    <Text style={styles.itemDescription}>{item.description}</Text>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </ScrollView>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>{collapsed ? '×' : 'Fechar menu'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15, 23, 42, 0.48)' },
  panel: {
    width: 304,
    maxWidth: '84%',
    backgroundColor: '#ffffff',
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderTopRightRadius: 28,
    borderBottomRightRadius: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 12,
  },
  panelCollapsed: { width: 92, paddingHorizontal: 10 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  brandIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#1e40af',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIconText: { color: '#ffffff', fontWeight: '900' },
  brandText: { flex: 1 },
  title: { color: '#0f172a', fontSize: 22, fontWeight: '900' },
  subtitle: { color: '#64748b', fontWeight: '700' },
  collapseButton: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  collapseText: { color: '#1e40af', fontWeight: '900' },
  list: { flex: 1 },
  listContent: { gap: 10, paddingBottom: 12 },
  item: {
    minHeight: 58,
    borderRadius: 18,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemDanger: { backgroundColor: '#fef2f2', borderColor: '#fecaca' },
  itemIcon: { fontSize: 24, width: 30, textAlign: 'center' },
  itemTextWrap: { flex: 1, gap: 3 },
  itemLabel: { color: '#0f172a', fontWeight: '900', fontSize: 15 },
  itemDangerLabel: { color: '#991b1b' },
  itemDescription: { color: '#64748b', fontSize: 12, lineHeight: 16 },
  closeButton: { backgroundColor: '#0f172a', borderRadius: 16, padding: 14, alignItems: 'center' },
  closeButtonText: { color: '#ffffff', fontWeight: '900' },
});
