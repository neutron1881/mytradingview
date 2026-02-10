'use client';
import { useOptionExposure } from "@/lib/hooks";
import { Box, Container, Dialog, Grid, IconButton, LinearProgress, Paper } from "@mui/material";
import { useState } from "react";
import { ChartTypeSelectorTab } from "./ChartTypeSelectorTab";
import { DataModeType, DexGexType } from "@/lib/types";
import { parseAsBoolean, parseAsInteger, parseAsString, parseAsStringEnum, useQueryState } from "nuqs";
import { MemoizedGreeksExposureChart } from "./GreeksExposureChart";
import { UpdateFrequencyDisclaimer } from "./UpdateFrequencyDisclaimer";
import { HistoricalDateSlider } from "./HistoricalDateSlider";
import { DteStrikeSelector } from "./DteStrikeSelector";
const symbolsWithDailyOptions = ["NDX", "RUT", "XSP", "SPX", "QQQ", "SPY", "IWM"]; //will make it configurable later
export const OptionsExposure = (props: { symbol: string, cachedDates: string[] }) => {
    const { symbol, cachedDates } = props;
    const [printMode] = useQueryState('print', parseAsBoolean.withDefault(false));
    const [historicalDate, setHistoricalDate] = useQueryState('historical', parseAsString.withDefault(cachedDates.at(-1) || ''));
    const showZeroAndNextDte = symbolsWithDailyOptions.includes(symbol);
    const [dte, setDte] = useQueryState('dte', parseAsInteger.withDefault(symbolsWithDailyOptions.includes(symbol) ? 7 : 50));   //
    const [selectedExpirations, setSelectedExpirations] = useState<string[]>([]);
    const [strikeCounts, setStrikesCount] = useQueryState('sc', parseAsString.withDefault('30'));
    const [exposureTab, setexposureTab] = useQueryState<DexGexType>('dgextab', parseAsStringEnum<DexGexType>(Object.values(DexGexType)).withDefault(DexGexType.DEX));
    const [dataMode, setDataMode] = useQueryState<DataModeType>('mode', parseAsStringEnum<DataModeType>(Object.values(DataModeType)).withDefault(DataModeType.CBOE));
    const [refreshToken, setRefreshToken] = useState('');
    const { exposureData, isLoading, hasError, expirationData, filteredExportData } = useOptionExposure(symbol, dte, selectedExpirations, strikeCounts, exposureTab, dataMode, historicalDate, refreshToken);
    const timestamp = exposureData?.timestamp;

    const downloadCsv = () => {
        if (!filteredExportData || filteredExportData.length === 0) return;

        const headers = ['Expiration', 'DTE', 'Strike', 'Net Gamma', 'Call Delta', 'Put Delta', 'Call Gamma', 'Put Gamma', 'Call OI', 'Put OI', 'Call Vol', 'Put Vol'];
        const csvContent = [
            headers.join(','),
            ...filteredExportData.flatMap(exp =>
                exp.strikes.map((strike, idx) => [
                    exp.expiration,
                    exp.dte,
                    strike,
                    exp.netGamma[idx] || 0,
                    exp.call.absDelta[idx] || 0,
                    exp.put.absDelta[idx] || 0,
                    exp.call.absGamma[idx] || 0,
                    exp.put.absGamma[idx] || 0,
                    exp.call.openInterest[idx] || 0,
                    exp.put.openInterest[idx] || 0,
                    exp.call.volume[idx] || 0,
                    exp.put.volume[idx] || 0
                ].join(','))
            )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `${symbol}_options_exposure_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    const exposureChartContent = <Box sx={{ m: 1 }} minHeight={400}>{
        (isLoading && !exposureData) ? (    //keep it loading only if there's no data to display. Otherwise the mui charts loading indicator is enough
            <LinearProgress />
        ) : hasError ? (
            <i data-testid="EXPOSURE-CHART-ERROR-OCCURRED">Error occurred! Please try again...</i>
        ) : (
            exposureData && (
                <MemoizedGreeksExposureChart
                    skipAnimation={printMode}
                    exposureData={exposureData}
                    dte={dte}
                    symbol={symbol}
                    exposureType={exposureTab}
                    isLoading={isLoading}
                />
            )
        )
    }</Box>
    if (printMode) {
        return <Dialog fullWidth={true} fullScreen={true} open={true} aria-labelledby="delta-hedging-dialog" scroll='body'>
            {exposureChartContent}
        </Dialog>
    }

    const startHistoricalAnimation = async () => {
        const delayMs = 1000;
        for (const d of cachedDates) {
            setTimeout(() => {
                setHistoricalDate(d);
            }, delayMs);
            await new Promise((r) => setTimeout(r, delayMs));
        }
    }

    return <Container maxWidth="md" sx={{ p: 0 }}>

        <DteStrikeSelector dte={dte} strikeCounts={strikeCounts}
            availableDates={expirationData.map(k => k.expiration)}
            setCustomExpirations={setSelectedExpirations}
            timestamp={timestamp}
            onRefresh={() => setRefreshToken(new Date().toISOString())}
            showZeroAndNextDte={showZeroAndNextDte}
            setDte={setDte} setStrikesCount={setStrikesCount} symbol={symbol} dataMode={dataMode} setDataMode={setDataMode} hasHistoricalData={cachedDates.length > 0} />
        <Paper sx={{ mt: 1 }}>
            <Box display="flex" alignItems="center" justifyContent="space-between" pr={2}>
                <ChartTypeSelectorTab tab={exposureTab} onChange={setexposureTab} />
                <IconButton onClick={downloadCsv} title="Export to CSV" size="small">
                    {/* Fallback to text if icon not available, or use a generic icon if imports allow. 
                        Since I can't easily check installed icons without potential errors, I'll use a text-based representation or a standard SVG if possible. 
                        Actually, let's just use a simple SVG directly to avoid dependency issues. */}
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                </IconButton>
            </Box>
            {exposureChartContent}
        </Paper>
        {
            dataMode == DataModeType.HISTORICAL && <HistoricalDateSlider dates={cachedDates} onChange={(v) => setHistoricalDate(v)} currentValue={historicalDate} />
        }
        <UpdateFrequencyDisclaimer />
    </Container>
}

