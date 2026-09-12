/**
 * PDF.JS - GERADORES DE PDF DO PORTAL DO DOCENTE SENAI
 * Usa jsPDF + jspdf-autotable (carregados via CDN nas páginas).
 * Requer internet na primeira carga do CDN.
 */

function SENAI_pdfDisponivel() {
  return !!(window.jspdf && window.jspdf.jsPDF);
}

/* PDF DO DIÁRIO DE CLASSE (turma inteira) */
function SENAI_gerarPdfDiario(students, opts) {
  if (!SENAI_pdfDisponivel()) {
    return { ok: false, error: 'pdf-offline' };
  }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const config = SENAI_loadConfig();
    const session = SENAI_getSession();
    const turmaLabel = (opts && opts.turma) || config.turma;
    const discLabel = (opts && opts.disciplina) || config.disciplina;
    const dateStr = SENAI_formatDate(new Date());

    const presentes = students.filter(s => s.status !== 'absent').length;
    const ausentes = students.filter(s => s.status === 'absent').length;
    const media = SENAI_avgNota(students);

    // Header bar
    doc.setFillColor(213, 0, 28);
    doc.rect(0, 0, pageW, 52, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('SENAI - SERVIÇO NACIONAL DE APRENDIZAGEM INDUSTRIAL', 28, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('RELATÓRIO DO DIÁRIO DE CLASSE  |  PORTAL DO DOCENTE', 28, 38);
    doc.text(dateStr, pageW - 28, 22, { align: 'right' });

    // Info grid
    const infoY = 68;
    const labels = [
      ['TURMA:', turmaLabel],
      ['DISCIPLINA:', discLabel],
      ['OFICINA:', (opts && opts.oficina) || config.oficina],
      ['PROFESSOR:', `Prof. ${session.name}`],
      ['TURNO:', (opts && opts.turno) || config.turno],
      ['DATA:', dateStr]
    ];
    if (opts && opts.subturma) labels.push(['SUBTURMA:', opts.subturma]);
    const colW = pageW / 6;
    labels.forEach(([lbl, val], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 28 + col * colW;
      const y = infoY + row * 18;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(130, 130, 130);
      doc.text(lbl, x, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text(String(val).substring(0, 32), x + doc.getTextWidth(lbl) + 4, y);
    });

    // Summary boxes
    const boxY = infoY + 52;
    const boxW = (pageW - 56) / 4;
    const boxes = [
      { label: 'TOTAL DE ALUNOS', val: String(students.length), color: [30, 41, 59] },
      { label: 'PRESENTE(S)', val: String(presentes), color: [5, 150, 105] },
      { label: 'AUSENTE(S)', val: String(ausentes), color: [220, 38, 38] },
      { label: 'MÉDIA DA TURMA', val: media.toFixed(1), color: [13, 71, 161] }
    ];
    boxes.forEach((b, i) => {
      const bx = 28 + i * (boxW + 4);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(bx, boxY, boxW, 44, 4, 4, 'F');
      doc.setFillColor(...b.color);
      doc.rect(bx, boxY, boxW, 4, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(b.label, bx + 8, boxY + 18);
      doc.setFontSize(20);
      doc.setTextColor(...b.color);
      doc.text(b.val, bx + 8, boxY + 36);
    });

    // Table
    const tableBody = students.map((s, i) => [
      String(i + 1), s.name, s.matricula, s.bancada,
      `${s.freq}%`, String(s.nota),
      s.status === 'present' ? 'Presente' : (s.status === 'late' ? 'Atrasado' : 'Ausente'), s.riskLabel
    ]);
    const presentIdx = students.map(s => s.status === 'absent' ? 'absent' : 'present');

    doc.autoTable({
      startY: boxY + 60,
      head: [['#', 'Aluno', 'Matrícula', 'Bancada', 'Freq.', 'Nota (0-100)', 'Status', 'Risco']],
      body: tableBody,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.3 },
      headStyles: { fillColor: [213, 0, 28], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 24, halign: 'center' },
        4: { cellWidth: 42, halign: 'center' },
        5: { cellWidth: 60, halign: 'center', fontStyle: 'bold' },
        6: { cellWidth: 52, halign: 'center' },
        7: { cellWidth: 80 }
      },
      didParseCell: function (data) {
        if (data.section === 'body') {
          const status = presentIdx[data.row.index];
          if (data.column.index === 5) {
            const notaVal = Number(data.cell.raw);
            if (notaVal < 60) data.cell.styles.textColor = [220, 38, 38];
            else if (notaVal < 80) data.cell.styles.textColor = [217, 119, 6];
          }
          if (data.column.index === 6) {
            if (status === 'absent') {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [5, 150, 105];
            }
          }
        }
      },
      margin: { left: 28, right: 28 },
      didDrawPage: function () {
        const footerY = pageH - 24;
        doc.setDrawColor(226, 232, 240);
        doc.line(28, footerY - 10, pageW - 28, footerY - 10);
        doc.setFontSize(7);
        doc.setTextColor(148, 163, 184);
        doc.text(`Relatório gerado em ${dateStr} por Portal do Docente SENAI`, 28, footerY);
        doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageW - 28, footerY, { align: 'right' });
      }
    });

    // Signature area
    const lastY = doc.lastAutoTable.finalY;
    const sign = () => {
      let sigY = lastY + 40;
      if (lastY + 40 > pageH - 60) {
        doc.addPage();
        sigY = pageH - 70;
      }
      doc.setDrawColor(60, 60, 60);
      doc.line(48, sigY, 280, sigY);
      doc.line(pageW / 2 + 28, sigY, pageW - 48, sigY);
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.setFont('helvetica', 'normal');
      doc.text(`Prof. ${session.name}`, 48, sigY + 14);
      doc.text('Coordenador / Responsável', pageW / 2 + 28, sigY + 14);
    };
    sign();

    const subSeg = (opts && opts.subturma) ? '-' + String(opts.subturma).toLowerCase().replace(/\s+/g, '-') : '';
    const filename = `diario-de-classe-${String(turmaLabel).toLowerCase().replace(/\s+/g, '-')}${subSeg}-${dateStr.replace(/\//g, '-')}.pdf`;
    doc.save(filename);
    return { ok: true, filename: filename };
  } catch (e) {
    console.error('Erro ao gerar PDF do diário:', e);
    return { ok: false, error: String(e.message || e) };
  }
}

/* FICHA INDIVIDUAL DO ALUNO */
function SENAI_gerarPdfFicha(student, opts) {
  if (!SENAI_pdfDisponivel()) {
    return { ok: false, error: 'pdf-offline' };
  }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const config = SENAI_loadConfig();
    const session = SENAI_getSession();
    const ocorrencias = (opts && opts.ocorrencias) ||[];
    const aulas = (opts && opts.aulas) || [];
    const dateStr = SENAI_formatDate(new Date());

    // Header
    doc.setFillColor(213, 0, 28);
    doc.rect(0, 0, pageW, 56, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text('SENAI - SERVIÇO NACIONAL DE APRENDIZAGEM INDUSTRIAL', 28, 22);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(config.unidade || '', 28, 36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('FICHA INDIVIDUAL DO ALUNO', 28, 50);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(dateStr, pageW - 28, 22, { align: 'right' });

    // Identificação
    let y = 80;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(130, 130, 130);
    const info = [
      ['ALUNO:', student.name],
      ['MATRÍCULA:', student.matricula],
      ['BANCADA:', student.bancada],
      ['TURMA:', config.turma],
      ['CURSO:', config.curso],
      ['DISCIPLINA:', config.disciplina]
    ];
    info.forEach(([lbl, val]) => {
      doc.text(lbl, 28, y);
      doc.setTextColor(40, 40, 40);
      doc.setFont('helvetica', 'normal');
      doc.text(String(val).substring(0, 70), 28 + 90, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(130, 130, 130);
      y += 15;
    });

    // Resumo
    y += 8;
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(28, y, pageW - 56, 52, 4, 4, 'F');
    const media = SENAI_avgNota([student]);
    const freqAtual = student.freq;
    const st = student.status === 'absent' ? 'AUSENTE HOJE' : (student.status === 'late' ? 'ATRASADO HOJE' : 'PRESENTE HOJE');
    const boxes = [
      { label: 'MÉDIA (0-100)', val: media.toFixed(1), color: [13, 71, 161] },
      { label: 'FREQUÊNCIA', val: freqAtual + '%', color: freqAtual < 75 ? [220, 38, 38] : [5, 150, 105] },
      { label: 'STATUS', val: st, color: student.status === 'absent' ? [220, 38, 38] : (student.status === 'late' ? [217, 119, 6] : [5, 150, 105]) },
      { label: 'RISCO', val: student.riskLabel || '-', color: student.risk === 'high' ? [220, 38, 38] : student.risk === 'medium' ? [217, 119, 6] : [5, 150, 105] }
    ];
    const bw = (pageW - 56) / 4;
    boxes.forEach((b, i) => {
      const bx = 28 + i * bw;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(b.label, bx + 6, y + 16);
      doc.setFontSize(11);
      doc.setTextColor(...b.color);
      doc.text(String(b.val).substring(0, 14), bx + 6, y + 34);
    });
    y += 72;

    // Tabela de avaliações
    const aval = student.avaliacoes || [];
    const avalRows = aval.map(a => [a.nome, String((Number(a.peso) * 100).toFixed(0)) + '%', String(a.nota)]);
    avalRows.push(['MÉDIA PONDERADA', '', String(media.toFixed(1))]);
    doc.autoTable({
      startY: y,
      head: [['Avaliação', 'Peso', 'Nota (0-100)']],
      body: avalRows,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8.5, cellPadding: 4, textColor: [30, 41, 59] },
      headStyles: { fillColor: [213, 0, 28], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 200 }, 1: { cellWidth: 90, halign: 'center' }, 2: { cellWidth: 90, halign: 'center', fontStyle: 'bold' } },
      margin: { left: 28, right: 28 }
    });
    y = doc.lastAutoTable.finalY + 24;

    // Histórico de presença
    if (y + 120 > pageH - 60) { doc.addPage(); y = 48; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Histórico de Presença', 28, y);
    const pastAulas = aulas.filter(a => a.date !== SENAI_todayKey());
    const presentCount = pastAulas.filter(a => (a.presenteIds || []).indexOf(student.id) !== -1).length;
    const presRows = pastAulas.slice().reverse().map(a => [
      SENAI_formatDateKey(a.date),
      (a.presenteIds || []).indexOf(student.id) !== -1 ? 'Presente' : 'Ausente',
      a.tema || ''
    ]);
    doc.autoTable({
      startY: y + 8,
      head: [['Data', 'Presença', 'Aula']],
      body: presRows,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 70, halign: 'center' } },
      margin: { left: 28, right: 28 }
    });
    y = doc.lastAutoTable.finalY + 16;

    // Ocorrências
    if (y + 130 > pageH - 90) { doc.addPage(); y = 48; }
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Ocorrências Registradas', 28, y);
    const occRows = ocorrencias.map(o => [
      SENAI_formatDate(o.data), o.tipo || '', o.severidade || '', o.status || ''
    ]);
    doc.autoTable({
      startY: y + 8,
      head: [['Data', 'Tipo', 'Severidade', 'Status']],
      body: occRows.length > 0 ? occRows : [['-', 'Nenhuma ocorrência registrada', '-', '-']],
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [51, 65, 85], textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { left: 28, right: 28 }
    });
    y = doc.lastAutoTable.finalY + 40;

    // Assinaturas
    if (y > pageH - 80) { doc.addPage(); y = pageH - 80; }
    doc.setDrawColor(80, 80, 80);
    doc.line(28, y, 240, y);
    doc.line(pageW / 2 + 14, y, pageW - 28, y);
    doc.setFontSize(8.5);
    doc.setTextColor(90, 90, 90);
    doc.setFont('helvetica', 'normal');
    doc.text(`Prof. ${session.name}`, 28, y + 14);
    doc.text('Coordenador / Responsável', pageW / 2 + 14, y + 14);

    // Footer
    doc.setDrawColor(226, 232, 240);
    doc.line(28, pageH - 30, pageW - 28, pageH - 30);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Documento gerado pelo Portal do Docente SENAI', 28, pageH - 20);
    doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageW - 28, pageH - 20, { align: 'right' });

    const filename = `ficha-${student.matricula || student.id}-${dateStr.replace(/\//g, '-')}.pdf`;
    doc.save(filename);
    return { ok: true, filename: filename };
  } catch (e) {
    console.error('Erro ao gerar ficha PDF:', e);
    return { ok: false, error: String(e.message || e) };
  }
}

/* RELATÓRIO PEDAGÓGICO (notas por avaliação + evolução da frequência) */
function SENAI_gerarPdfAvaliacoes(students, opts) {
  if (!SENAI_pdfDisponivel()) {
    return { ok: false, error: 'pdf-offline' };
  }
  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const config = SENAI_loadConfig();
    const session = SENAI_getSession();
    const turmaLabel = (opts && opts.turma) || config.turma;
    const discLabel = (opts && opts.disciplina) || config.disciplina;
    const dateStr = SENAI_formatDate(new Date());
    const template = (config.avaliacoesTemplate || [
      { nome: 'AV1', peso: 0.3 }, { nome: 'AV2', peso: 0.3 }, { nome: 'PRÁTICA', peso: 0.4 }
    ]);
    const avalNames = template.map(t => String(t.nome).toUpperCase());

    // Header bar
    doc.setFillColor(213, 0, 28);
    doc.rect(0, 0, pageW, 52, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('SENAI - SERVIÇO NACIONAL DE APRENDIZAGEM INDUSTRIAL', 28, 22);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('RELATÓRIO PEDAGÓGICO  |  PORTAL DO DOCENTE', 28, 38);
    doc.text(dateStr, pageW - 28, 22, { align: 'right' });

    // Info grid
    const infoY = 68;
    const labels = [
      ['TURMA:', turmaLabel],
      ['DISCIPLINA:', discLabel],
      ['OFICINA:', (opts && opts.oficina) || config.oficina],
      ['PROFESSOR:', `Prof. ${session.name}`],
      ['TURNO:', (opts && opts.turno) || config.turno],
      ['DATA:', dateStr]
    ];
    if (opts && opts.subturma) labels.push(['SUBTURMA:', opts.subturma]);
    const colW = pageW / 6;
    labels.forEach(([lbl, val], i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = 28 + col * colW;
      const y = infoY + row * 18;
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(130, 130, 130);
      doc.text(lbl, x, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40, 40, 40);
      doc.text(String(val).substring(0, 32), x + doc.getTextWidth(lbl) + 4, y);
    });

    // Média por avaliação (boxes)
    const boxY = infoY + 52;
    const medias = avalNames.map(name => {
      const vals = students.map(s => {
        const av = (s.avaliacoes || []).find(a => String(a.nome).toUpperCase() === name);
        return av ? Number(av.nota) || 0 : null;
      }).filter(v => v !== null);
      return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
    });
    const mediaFinal = students.length ? SENAI_avgNota(students) : 0;
    const boxCount = avalNames.length + 1;
    const boxW = (pageW - 56 - 4 * (boxCount - 1)) / boxCount;

    const avalBoxes = avalNames.map((name, i) => ({
      label: 'MÉDIA ' + name, val: medias[i].toFixed(1), color: [13, 71, 161]
    }));
    avalBoxes.push({ label: 'MÉDIA FINAL', val: mediaFinal.toFixed(1), color: [213, 0, 28] });
    avalBoxes.forEach((b, i) => {
      const bx = 28 + i * (boxW + 4);
      doc.setFillColor(241, 245, 249);
      doc.roundedRect(bx, boxY, boxW, 42, 4, 4, 'F');
      doc.setFillColor(...b.color);
      doc.rect(bx, boxY, boxW, 4, 'F');
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(b.label, bx + 6, boxY + 16);
      doc.setFontSize(18);
      doc.setTextColor(...b.color);
      doc.text(b.val, bx + 6, boxY + 34);
    });

    // Tabela por aluno com todas as avaliações
    const notaDe = (s, name) => {
      const av = (s.avaliacoes || []).find(a => String(a.nome).toUpperCase() === name);
      return av ? String(av.nota) : '-';
    };
    const mainHead = ['#', 'Aluno', 'Matrícula'].concat(avalNames, ['Nota Final', 'Freq.', 'Risco']);
    const mainBody = students.map((s, i) => [
      String(i + 1), s.name, s.matricula
    ].concat(avalNames.map(n => notaDe(s, n)), [String(s.nota), `${s.freq}%`, s.riskLabel]));

    doc.autoTable({
      startY: boxY + 58,
      head: [mainHead],
      body: mainBody,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.3 },
      headStyles: { fillColor: [213, 0, 28], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      columnStyles: {
        0: { cellWidth: 24, halign: 'center' },
        2: { cellWidth: 82 },
        4: { cellWidth: 34, halign: 'center' },
        5: { cellWidth: 34, halign: 'center' },
        6: { cellWidth: 36, halign: 'center', fontStyle: 'bold' },
        7: { cellWidth: 44, halign: 'center' },
        8: { cellWidth: 60 }
      },
      margin: { left: 28, right: 28 },
      didParseCell: function (data) {
        if (data.section === 'body' && (data.column.index === 3 || data.column.index === 4 || data.column.index === 5 || data.column.index === 6)) {
          const v = Number(data.cell.raw);
          if (!isNaN(v)) {
            if (v < 60) data.cell.styles.textColor = [220, 38, 38];
            else if (v < 80) data.cell.styles.textColor = [180, 83, 9];
          }
        }
      }
    });

    // Evolução da frequência por semana
    const aulas = (opts && opts.aulas) || SENAI_loadAulas();
    const semanal = SENAI_frequenciaSemanal(students, aulas);
    let y2 = doc.lastAutoTable.finalY + 30;
    if (y2 + 120 > pageH) { doc.addPage(); y2 = 56; }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Evolução da Frequência por Semana', 28, y2);

    const semHead = ['Semana', 'Aulas', 'Média de Presença', 'Alunos abaixo de 75%', 'Melhor Frequência'];
    const semBody = semanal.map(w => [
      w.label, String(w.aulasN), `${w.media}%`, String(w.abaixoDe75), `${w.melhor}%`
    ]);
    if (semBody.length === 0) semBody.push(['-', '-', '-', '-', '-']);

    doc.autoTable({
      startY: y2 + 8,
      head: [semHead],
      body: semBody,
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 8, cellPadding: 4, textColor: [30, 41, 59] },
      headStyles: { fillColor: [13, 71, 161], textColor: [255, 255, 255], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 130 },
        1: { cellWidth: 60, halign: 'center' },
        2: { cellWidth: 110, halign: 'center' },
        3: { cellWidth: 130, halign: 'center' },
        4: { cellWidth: 110, halign: 'center' }
      },
      margin: { left: 28, right: 28 },
      didParseCell: function (data) {
        if (data.section === 'body' && (data.column.index === 2)) {
          const v = Number(String(data.cell.raw).replace('%', ''));
          if (v < 70) data.cell.styles.textColor = [220, 38, 38];
        }
      }
    });

    // Footer
    const footerY = pageH - 24;
    doc.setDrawColor(226, 232, 240);
    doc.line(28, footerY - 10, pageW - 28, footerY - 10);
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(`Relatório gerado em ${dateStr} por Portal do Docente SENAI`, 28, footerY);
    doc.text(`Página ${doc.internal.getNumberOfPages()}`, pageW - 28, footerY, { align: 'right' });

    const subSeg = (opts && opts.subturma) ? '-' + String(opts.subturma).toLowerCase().replace(/\s+/g, '-') : '';
    const filename = `relatorio-pedagogico-${String(turmaLabel).toLowerCase().replace(/\s+/g, '-')}${subSeg}-${dateStr.replace(/\//g, '-')}.pdf`;
    doc.save(filename);
    return { ok: true, filename: filename };
  } catch (e) {
    console.error('Erro ao gerar relatório pedagógico:', e);
    return { ok: false, error: String(e.message || e) };
  }
}

/* Frequência semanal (agrupada por semana, segunda como início) */
function SENAI_frequenciaSemanal(students, aulas) {
  const semanaBase = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    const dia = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - dia);
    return d;
  };
  const fmt = (d) => {
    const p = n => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
  };

  const porSemana = {};
  aulas.forEach(a => {
    if (!a || !a.date) return;
    const base = semanaBase(a.date);
    const chave = base.toISOString().slice(0, 10);
    if (!porSemana[chave]) porSemana[chave] = { aulas: [], label: `${fmt(base)} a ${fmt(new Date(base.getTime() + 4 * 86400000))}` };
    porSemana[chave].aulas.push(a);
  });

  const chaves = Object.keys(porSemana).sort();
  return chaves.map(chave => {
    const grp = porSemana[chave];
    const aulasN = grp.aulas.length;
    let sum = 0, abaixo = 0, melhorFreq = 0;
    students.forEach(s => {
      const presentes = grp.aulas.filter(a => (a.presenteIds || []).indexOf(s.id) !== -1).length;
      const freq = aulasN ? Math.round((presentes / aulasN) * 100) : 0;
      sum += freq;
      if (aulasN && freq < 75) abaixo++;
      if (aulasN && freq > melhorFreq) melhorFreq = freq;
    });
    return {
      label: grp.label,
      aulasN: String(aulasN),
      media: aulasN ? Math.round((sum / students.length) * 100) / 100 : 0,
      abaixoDe75: String(abaixo),
      melhor: String(melhorFreq > 0 || aulasN ? melhorFreq : 0)
    };
  });
}