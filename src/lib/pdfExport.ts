import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Medication, Dose, WeightEntry, SymptomLog } from '../types';
import { format } from 'date-fns';

export function generatePDF(
  medications: Medication[],
  doses: Dose[],
  weightEntries: WeightEntry[],
  symptomLogs: SymptomLog[]
): jsPDF {
  const doc = new jsPDF();
  let yPos = 20;

  // Header
  doc.setFontSize(22);
  doc.setTextColor(20, 184, 166);
  doc.text('PeptyTrack Report', 105, yPos, { align: 'center' });
  yPos += 12;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${format(new Date(), 'PPP p')}`, 105, yPos, { align: 'center' });
  yPos += 8;
  doc.text('This report is for informational purposes only. Consult your healthcare provider.', 105, yPos, { align: 'center' });
  yPos += 20;

  // Medication Summary
  doc.setFontSize(14);
  doc.setTextColor(20, 184, 166);
  doc.text('Medication Overview', 14, yPos);
  yPos += 10;

  autoTable(doc, {
    startY: yPos,
    head: [['Medication', 'Brand', 'Active Ingredient', 'Frequency', 'Half-Life']],
    body: medications.map((m) => [
      m.name,
      m.brand,
      m.activeIngredient,
      m.frequency,
      `${m.halfLifeHours}h`,
    ]),
    theme: 'grid',
    headStyles: { fillColor: [20, 184, 166], textColor: 255 },
    styles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
  });
  yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;

  const medMap = Object.fromEntries(medications.map((m) => [m.id, m.name]));

  // Dose History
  if (doses.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.setTextColor(20, 184, 166);
    doc.text('Dose History', 14, yPos);
    yPos += 10;

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Medication', 'Dosage', 'Injection Site', 'Side Effects']],
      body: doses
        .sort((a, b) => b.dateTime - a.dateTime)
        .map((d) => [
          format(new Date(d.dateTime), 'PP p'),
          medMap[d.medicationId] || 'Unknown',
          `${d.dosage} ${d.unit}`,
          d.injectionSite.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          d.sideEffects?.map(se => typeof se === 'string' ? se : `${se.label} (${se.severity})`).join(', ') || '-',
        ]),
      theme: 'grid',
      headStyles: { fillColor: [20, 184, 166], textColor: 255 },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }

  // Independent Symptom History
  if (symptomLogs.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.setTextColor(20, 184, 166);
    doc.text('Independent Symptom Logs', 14, yPos);
    yPos += 10;

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Medication', 'Symptoms Reported']],
      body: symptomLogs
        .sort((a, b) => b.dateTime - a.dateTime)
        .map((l) => [
          format(new Date(l.dateTime), 'PP p'),
          medMap[l.medicationId] || 'Unknown',
          l.symptoms.map(se => typeof se === 'string' ? se : `${se.label} (${se.severity})`).join(', ') || '-',
        ]),
      theme: 'grid',
      headStyles: { fillColor: [20, 184, 166], textColor: 255 },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
    yPos = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 15;
  }

  // Weight History
  if (weightEntries.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }
    doc.setFontSize(14);
    doc.setTextColor(20, 184, 166);
    doc.text('Weight History', 14, yPos);
    yPos += 10;

    autoTable(doc, {
      startY: yPos,
      head: [['Date', 'Weight', 'Notes']],
      body: weightEntries
        .sort((a, b) => b.dateTime - a.dateTime)
        .map((w) => [
          format(new Date(w.dateTime), 'PP'),
          `${w.weight} ${w.unit}`,
          w.notes || '-',
        ]),
      theme: 'grid',
      headStyles: { fillColor: [20, 184, 166], textColor: 255 },
      styles: { fontSize: 9 },
      margin: { left: 14, right: 14 },
    });
  }

  return doc;
}

export function downloadPDF(doc: jsPDF, filename?: string): void {
  doc.save(filename || `peptytrack-report-${new Date().toISOString().split('T')[0]}.pdf`);
}
