package com.onecore.tap.plates;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;

import javax.imageio.ImageIO;

import org.openpdf.text.Document;
import org.openpdf.text.DocumentException;
import org.openpdf.text.Element;
import org.openpdf.text.Font;
import org.openpdf.text.Image;
import org.openpdf.text.PageSize;
import org.openpdf.text.Paragraph;
import org.openpdf.text.Phrase;
import org.openpdf.text.pdf.PdfPCell;
import org.openpdf.text.pdf.PdfPTable;
import org.openpdf.text.pdf.PdfWriter;
import org.springframework.stereotype.Service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;

/**
 * QR Codes das plaquinhas. Correcao de erro nivel M (tolera ~15% de dano/sujeira) e margem de silencio de
 * 4 modulos, o minimo da especificacao. Preto sobre branco, sem cor nem logotipo sobreposto.
 */
@Service
public class PlateQrService {

	static final int QUIET_ZONE_MODULES = 4;

	private static final Map<EncodeHintType, Object> HINTS = Map.of(EncodeHintType.ERROR_CORRECTION,
			ErrorCorrectionLevel.M, EncodeHintType.MARGIN, QUIET_ZONE_MODULES, EncodeHintType.CHARACTER_SET, "UTF-8");

	BitMatrix matrix(String content, int size) {
		try {
			return new QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, size, size, HINTS);
		}
		catch (WriterException ex) {
			throw new IllegalStateException("Falha ao gerar QR Code", ex);
		}
	}

	/** SVG vetorial: escala sem perda para qualquer tamanho de impressao. */
	public String svg(String content) {
		BitMatrix m = matrix(content, 0);
		int w = m.getWidth();
		StringBuilder path = new StringBuilder();
		for (int y = 0; y < w; y++) {
			for (int x = 0; x < w; x++) {
				if (m.get(x, y)) {
					path.append('M').append(x).append(' ').append(y).append("h1v1h-1z");
				}
			}
		}
		return """
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" shape-rendering="crispEdges">\
				<rect width="100%%" height="100%%" fill="#FFFFFF"/><path fill="#000000" d="%s"/></svg>"""
			.formatted(w, w, path);
	}

	public byte[] png(String content, int size) {
		try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			MatrixToImageWriter.writeToStream(matrix(content, size), "PNG", out);
			return out.toByteArray();
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
	}

	/** Folha A4 com etiquetas (3 x 4): QR Code, serial e token, para conferencia na producao. */
	public byte[] labelsPdf(String batchCode, List<Plate> plates, java.util.function.Function<String, String> urlOf) {
		try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
			Document doc = new Document(PageSize.A4, 28, 28, 36, 28);
			PdfWriter.getInstance(doc, out);
			doc.addTitle("OneCore Tap - Lote " + batchCode);
			doc.open();
			Font title = new Font(Font.HELVETICA, 12, Font.BOLD);
			Font serialFont = new Font(Font.HELVETICA, 10, Font.BOLD);
			Font small = new Font(Font.COURIER, 8, Font.NORMAL);
			doc.add(new Paragraph("OneCore Tap - Lote " + batchCode + " - " + plates.size() + " plaquinhas", title));
			doc.add(new Paragraph(" "));

			PdfPTable grid = new PdfPTable(3);
			grid.setWidthPercentage(100);
			for (Plate plate : plates) {
				String url = urlOf.apply(plate.getPublicToken());
				BufferedImage img = MatrixToImageWriter.toBufferedImage(matrix(url, 600));
				ByteArrayOutputStream pngOut = new ByteArrayOutputStream();
				ImageIO.write(img, "PNG", pngOut);
				Image qr = Image.getInstance(pngOut.toByteArray());
				qr.scaleAbsolute(120, 120);
				qr.setAlignment(Element.ALIGN_CENTER);

				PdfPCell cell = new PdfPCell();
				cell.setPadding(8);
				cell.setFixedHeight(185);
				cell.addElement(qr);
				Paragraph serial = new Paragraph(plate.getSerial(), serialFont);
				serial.setAlignment(Element.ALIGN_CENTER);
				cell.addElement(serial);
				Paragraph link = new Paragraph(new Phrase(url, small));
				link.setAlignment(Element.ALIGN_CENTER);
				cell.addElement(link);
				grid.addCell(cell);
			}
			grid.completeRow();
			doc.add(grid);
			doc.close();
			return out.toByteArray();
		}
		catch (IOException ex) {
			throw new UncheckedIOException(ex);
		}
		catch (DocumentException ex) {
			throw new IllegalStateException("Falha ao gerar PDF", ex);
		}
	}

}
