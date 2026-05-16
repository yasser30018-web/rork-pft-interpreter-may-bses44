import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect, Line, Path, Text as SvgText } from "react-native-svg";
import type { FVCurveType } from "@/types/pft";
import { FV_CURVES } from "@/constants/pftData";
import { useTheme } from "@/providers/ThemeProvider";

interface FVCurveViewProps {
  curveType: FVCurveType;
}

export default React.memo(function FVCurveView({ curveType }: FVCurveViewProps) {
  const { colors, scaledFont } = useTheme();

  if (!curveType || !FV_CURVES[curveType]) return null;

  const curve = FV_CURVES[curveType];

  return (
    <View style={[styles.container, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.textDim, fontSize: scaledFont(10) }]}>EXPECTED FV CURVE</Text>
      <Svg viewBox="0 0 180 100" style={styles.svg}>
        <Rect width={180} height={100} fill={colors.bgCard} rx={6} />
        <Line x1={15} y1={10} x2={15} y2={82} stroke={colors.border} strokeWidth={1} />
        <Line x1={15} y1={82} x2={170} y2={82} stroke={colors.border} strokeWidth={1} />
        <SvgText x={10} y={8} fill={colors.textDark} fontSize={6}>Flow</SvgText>
        <SvgText x={165} y={90} fill={colors.textDark} fontSize={6}>Vol</SvgText>
        <Path
          d="M 20,80 L 30,20 Q 50,15 60,18 L 140,70 Q 155,78 160,80"
          fill="none"
          stroke={colors.textDark}
          strokeWidth={1.5}
          strokeDasharray="4,3"
        />
        <Path
          d={curve.shape}
          fill="none"
          stroke={curve.color}
          strokeWidth={2.5}
        />
        <SvgText
          x={90}
          y={96}
          fill={curve.color}
          fontSize={5.5}
          textAnchor="middle"
        >
          {curve.desc}
        </SvgText>
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: { padding: 16, borderRadius: 14, marginBottom: 12, borderWidth: 1 },
  title: { letterSpacing: 1, marginBottom: 10, fontWeight: "600" as const },
  svg: { width: "100%", height: 140 },
});
