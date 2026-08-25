import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useOrderType, type OrderType } from '../context/OrderTypeContext';
import type { AppStackParamList } from '../navigation/types';
import { colors } from '../theme';

const LABELS: Record<OrderType, string> = { delivery: 'Delivery', pickup: 'Pickup' };

export default function OrderTypeDropdown() {
  const { orderType } = useOrderType();
  const navigation = useNavigation<NativeStackNavigationProp<AppStackParamList>>();

  return (
    <TouchableOpacity style={styles.trigger} onPress={() => navigation.navigate('SelectOutlet')} activeOpacity={0.75}>
      <Text style={styles.triggerText}>{LABELS[orderType]}</Text>
      <Text style={styles.chevron}>⌄</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  triggerText: { fontSize: 14, fontWeight: '700', color: colors.text },
  chevron: { fontSize: 14, color: colors.text },
});
