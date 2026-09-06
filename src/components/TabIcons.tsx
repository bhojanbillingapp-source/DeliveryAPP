import React from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';

type IconProps = { color: string; size: number };

export function HomeIcon({ color, size }: IconProps) {
  return <Ionicons name="home-outline" color={color} size={size} />;
}

export function MenuIcon({ color, size }: IconProps) {
  return <Ionicons name="restaurant-outline" color={color} size={size} />;
}

export function BagIcon({ color, size }: IconProps) {
  return <Ionicons name="receipt-outline" color={color} size={size} />;
}

export function MoreIcon({ color, size }: IconProps) {
  return <Ionicons name="ellipsis-horizontal-outline" color={color} size={size} />;
}
